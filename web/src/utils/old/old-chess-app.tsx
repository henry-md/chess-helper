import { useState, useRef, useCallback, useEffect } from 'react';
import Board from "../../components/board";
import { Chess, Move } from "chess.js";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faToggleOn, faToggleOff } from '@fortawesome/free-solid-svg-icons'
import { useStore } from '@nanostores/react'
import { $mainlines, setMainlines, $numMovesToFirstBranch, setNumMovesToFirstBranch } from '../../store/game-core'
import { cn } from '../../lib/utils'
import { NODE_ENV } from "@/env";
import EditPgnDialog from '../../components/board-edit-dialog';
import { StoredPgn } from '@/lib/types';
import { $pgn } from '../../store/pgn';
import { toast } from 'react-toastify';

// Custom hooks for game state
import useSkipping from '@/hooks/game/use-skipping';
import usePlayingColor from '@/hooks/game/use-playing-color';

const debug = NODE_ENV === "development";

type ChessAppProps = {
  isTutorial?: boolean;
};

function ChessApp({ isTutorial = false }: ChessAppProps) {
  const pgn: StoredPgn | null = useStore($pgn);
  
  if (!pgn) return <div>Loading...</div>;

  // Game settings
  const { isSkipping, setIsSkipping } = useSkipping(pgn);
  const { isPlayingWhite, setIsPlayingWhite } = usePlayingColor(pgn);
  
  // Game state
  const [currFen, setCurrFen] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  
  // Game logic
  const mainlines = useStore($mainlines);
  const numMovesToFirstBranch = useStore($numMovesToFirstBranch);
  const chessRef = useRef(new Chess());
  const movesRef = useRef([]);
  const currMoveIdxRef = useRef(-1);
  const maxMoveIdxRef = useRef(-1);
  const lineIdxRef = useRef(0);

  // const handleTextareaChange = async (event: React.ChangeEvent<HTMLTextAreaElement>) => {
  //   const newPgn = event.target.value;
  //   if (!pgn) return;

  //   // Update the PGN in both database and store
  //   const success = await updateCurrentPgn(
  //     pgn._id,
  //     pgn.title,
  //     newPgn,
  //     pgn.notes
  //   );

  //   if (success) {
  //     // Reset the game with new PGN
  //     // setCurrentPgn(newPgn);
  //     setMainlines(move(newPgn));
  //     setNumMovesToFirstBranch(findNumMovesToFirstBranch(newPgn));
      
  //     // Reset game state
  //     currMoveIdxRef.current = -1;
  //     maxMoveIdxRef.current = -1;
  //     lineIdxRef.current = 0;
  //     loadNextGame();
  //   }
  // };
  
  const handleKeyDown = useCallback((event) => {
    if (event.key === 'ArrowRight' && currMoveIdxRef.current < maxMoveIdxRef.current) {
      currMoveIdxRef.current++;
      chessRef.current.move(movesRef.current[currMoveIdxRef.current]);
      setCurrFen(chessRef.current.fen());
    } else if (event.key === 'ArrowLeft' && currMoveIdxRef.current >= 0) {
      chessRef.current.undo();
      currMoveIdxRef.current--;
      setCurrFen(chessRef.current.fen());
    }
  }, []);

  const getHint = () => {
    if (currMoveIdxRef.current === movesRef.current.length - 1) return;
    currMoveIdxRef.current++;
    chessRef.current.move(movesRef.current[currMoveIdxRef.current]);
    setCurrFen(chessRef.current.fen());
    setTimeout(() => {
      chessRef.current.undo();
      currMoveIdxRef.current--;
      setCurrFen(chessRef.current.fen());
    }, 500);
  };

  const playComputerMove = useCallback(() => {
    if (currMoveIdxRef.current === movesRef.current.length - 1) return;
    setTimeout(() => {
      currMoveIdxRef.current++;
      maxMoveIdxRef.current = Math.max(maxMoveIdxRef.current, currMoveIdxRef.current);
      chessRef.current.move(movesRef.current[currMoveIdxRef.current]);
      setCurrFen(chessRef.current.fen());
      console.log('currMoveIdxRef.current', currMoveIdxRef.current, 'of', movesRef.current.length - 1);
    }, 200);
  }, []);

  const loadNextGame = useCallback(() => {
    if (!mainlines || mainlines.length === 0) {
      chessRef.current.reset();
      setCurrFen(chessRef.current.fen());
      return;
    }

    chessRef.current.loadPgn(mainlines[lineIdxRef.current]);
    movesRef.current = chessRef.current.history();
    chessRef.current.reset();
    setCurrFen(chessRef.current.fen());
    currMoveIdxRef.current = -1;
    maxMoveIdxRef.current = -1;

    // play moves until next branching variation
    if (isSkipping) {
      for (let i = 0; i < numMovesToFirstBranch; i++) {
        setTimeout(() => {
          playComputerMove();
        }, 300 * (i + 1));
      }
    }

    // play next move if after skipping (or not), it is your opponent's move
    let skippingMovesPlayed = isSkipping ? numMovesToFirstBranch : 0;
    if (isPlayingWhite && skippingMovesPlayed % 2 === 1) {
      playComputerMove();
    } else if (!isPlayingWhite && skippingMovesPlayed % 2 === 0) {
      playComputerMove();
    }

  }, [mainlines, isPlayingWhite, isSkipping, numMovesToFirstBranch, playComputerMove]);

  const getNextGameIfEnded = useCallback(() => {
    if (currMoveIdxRef.current === movesRef.current.length - 1) {
      if (lineIdxRef.current === mainlines.length - 1) {
        toast.success("Game completed!");
      } else {
        lineIdxRef.current++;
        loadNextGame();
      }
    }
  }, [loadNextGame, mainlines.length]);

  const onDrop = (sourceSquare, targetSquare) => {
    const chess = chessRef.current;

    if (currMoveIdxRef.current < movesRef.current.length - 1) {
      const nextMove = movesRef.current[currMoveIdxRef.current + 1];
      const moveAttempt: Move = chess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      });

      if (moveAttempt && moveAttempt.san === nextMove) {
        currMoveIdxRef.current++;
        maxMoveIdxRef.current = Math.max(maxMoveIdxRef.current, currMoveIdxRef.current);
        setCurrFen(chess.fen());

        if (currMoveIdxRef.current != movesRef.current.length - 1) {
          playComputerMove();
        }
        getNextGameIfEnded();
        return true;
      } else {
        setCurrFen(chess.fen());
        setTimeout(() => {
          chess.undo();
          setCurrFen(chess.fen());
        }, 100);
        return true;
      }
    }

    return false;
  };

  // Restart game if settings change, or mainlines change
  useEffect(() => {
    currMoveIdxRef.current = -1;
    maxMoveIdxRef.current = -1;
    lineIdxRef.current = 0;
    loadNextGame();
  }, [isPlayingWhite, isSkipping, mainlines]);

  // Handle keyboard events
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <>
      <div className={cn(
        "w-full h-[100vh] flex justify-center items-center gap-4"
      )}>
        {/* Board */}
        <div style={{ width: 'min(80vh, 70vw)' }}>
          <Board
            currFen={currFen} 
            onPieceDrop={onDrop}
            isWhite={isPlayingWhite}
          />
        </div>

        {/* Aside */}
        <div className={cn(
          "flex flex-col items-center justify-center gap-2",
          debug && "border border-red-500"
        )} style={{ width: 'min(30vw, 400px)', height: 'min(80vh, 70vw)' }}>
          
          {/* Title Notes Pgn */}
          <div className={cn(
            "flex-grow flex flex-col h-full items-center w-full gap-3 p-3 pt-0",
            debug && "border border-blue-500"
          )}>
            <div className="flex flex-row items-center w-full gap-4 justify-left">
              <h3 className="text-2xl">{pgn?.title}</h3>
              {!isTutorial && (
                <button onClick={() => setEditDialogOpen(true)}>
                  <i className="fa-regular fa-pen-to-square"></i>
                </button>
              )}
            </div>
            <textarea
              value={pgn?.notes || ''}
              className="w-full p-2 border border-gray-300 rounded h-fit"
              placeholder="Type here..."
            />
            <textarea 
              value={pgn?.moveText || ''}
              readOnly={isTutorial}
              onFocus={isTutorial ? (event) => event.currentTarget.blur() : undefined}
              className={cn(
                "flex-grow w-full h-full p-2 border border-gray-300 rounded",
                isTutorial && "cursor-default"
              )}
              placeholder="Type here..."
            />
          </div>
          
          {/* Game Settings */}
          <div className="flex flex-row items-center justify-center gap-2">
            Play as:
            <button 
              className={`w-[25px] h-[25px] bg-[var(--board-light)] rounded-md ${isPlayingWhite ? 'border-2 border-[#827662]' : ''} box-border`} 
              onClick={() => setIsPlayingWhite(true)}
            ></button>
            <button 
              className={`w-[25px] h-[25px] bg-[var(--board-dark)] rounded-md ${!isPlayingWhite ? 'border-2 border-[#827662]' : ''} box-border`} 
              onClick={() => setIsPlayingWhite(false)}
            ></button>
          </div>
          <div className="flex flex-row items-center justify-center gap-2">
            Skip to first branch:
            <button 
              onClick={() => setIsSkipping(!isSkipping)}
            >
              <FontAwesomeIcon 
                className="text-[#411A06]" // dark: 411A06
                icon={isSkipping ? faToggleOn : faToggleOff} 
                size="lg"
              />
            </button>
          </div>

          {/* Hint Button */}
          <button 
            className="w-full p-2 border border-gray-300 rounded hover:bg-gray-100"
            onClick={getHint}
          >
            Hint
          </button>
        </div>
      </div>
      {pgn && (
        <EditPgnDialog pgn={pgn} open={editDialogOpen} setEditDialogOpen={setEditDialogOpen} />
      )}
    </>
  );
}

export default ChessApp;
