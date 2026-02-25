import { useCallback, useEffect, useState } from "react";
import Board from '@/components/Board';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faToggleOn, faToggleOff } from '@fortawesome/free-solid-svg-icons'
import { useStore } from '@nanostores/react'
import { cn } from '@/lib/utils'
import { NODE_ENV } from "@/env";
import EditPgnDialog from '@/components/board-edit-dialog';
import { StoredPgn } from '@/lib/types';
import { $pgn } from '@/store/pgn';
import { toast } from 'react-toastify';
import useLineQuizSession from "@/hooks/game/use-line-quiz-session";

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
  const { isSkipping, setIsSkipping } = useSkipping(pgn, { persistRemotely: !isTutorial });
  const { isPlayingWhite, setIsPlayingWhite } = usePlayingColor(pgn, {
    persistRemotely: !isTutorial,
  });
  
  // Game state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const {
    currFen,
    isAutoPlaying,
    onPieceDrop,
    showHint,
    stepBackward,
    stepForward,
  } = useLineQuizSession({
    moveText: pgn.moveText,
    isPlayingWhite,
    isSkipping,
    onSessionComplete: () => toast.success("Game completed!"),
  });

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        stepForward();
      } else if (event.key === "ArrowLeft") {
        stepBackward();
      }
    },
    [stepBackward, stepForward]
  );

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
            onPieceDrop={onPieceDrop}
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
              readOnly
              className="w-full p-2 border border-gray-300 rounded h-fit"
              placeholder="Notes"
            />
            <textarea 
              value={pgn?.moveText || ''}
              readOnly={isTutorial}
              onFocus={isTutorial ? (event) => event.currentTarget.blur() : undefined}
              className={cn(
                "flex-grow w-full h-full p-2 border border-gray-300 rounded",
                isTutorial && "cursor-default"
              )}
              placeholder="PGN"
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
            onClick={showHint}
            disabled={isAutoPlaying}
          >
            Hint
          </button>
        </div>
      </div>
      {pgn && !isTutorial && (
        <EditPgnDialog pgn={pgn} open={editDialogOpen} setEditDialogOpen={setEditDialogOpen} />
      )}
    </>
  );
}

export default ChessApp;
