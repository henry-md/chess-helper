import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Board from '@/components/Board';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faToggleOn, faToggleOff } from '@fortawesome/free-solid-svg-icons'
import { useStore } from '@nanostores/react'
import { Chess } from "chess.js";
import { cn } from '@/lib/utils'
import { NODE_ENV } from "@/env";
import EditPgnDialog from '@/components/BoardEditDialog';
import { StoredPgn } from '@/lib/types';
import { $pgn } from '@/store/pgn';
import { toast } from 'react-toastify';
import useLineQuizSession from "@/hooks/game/useLineQuizSession";
import LessonCompleteCelebration from "@/components/LessonCompleteCelebration";
import LineTransitionCelebration from "@/components/LineTransitionCelebration";
import TutorialCoachmarks from "@/components/TutorialCoachmarks";
import { moveTextToMainlines } from "@/utils/chess/pgn-parser";
import { MOVES_HIGHLIGHTED_IN_TUTORIAL } from "@/constants";

// Custom hooks for game state
import useSkipping from '@/hooks/game/useSkipping';
import usePlayingColor from '@/hooks/game/usePlayingColor';

const debug = NODE_ENV === "development";
const BOARD_FILES = "abcdefgh";

type GuidedMove = {
  moveIndex: number;
  san: string;
  instructionPrefix: string;
};

type SpotlightLayout = {
  boardSize: number;
  holeX: number;
  holeY: number;
  holeSize: number;
  noteLeft: number;
  noteTop: number;
  noteWidth: number;
};

type HighlightedTextSegment = {
  key: string;
  text: string;
  isHighlighted: boolean;
};

const stripMoveAnnotation = (token: string): string => token.replace(/[!?+#]+$/g, "");

const getSquareTopLeft = (
  square: string,
  isWhiteOrientation: boolean,
  squareSize: number
): { x: number; y: number } | null => {
  if (square.length !== 2) {
    return null;
  }

  const file = square[0];
  const rank = Number(square[1]);
  const fileIndex = BOARD_FILES.indexOf(file);
  if (fileIndex < 0 || rank < 1 || rank > 8) {
    return null;
  }

  const columnIndex = isWhiteOrientation ? fileIndex : 7 - fileIndex;
  const rowIndex = isWhiteOrientation ? 8 - rank : rank - 1;

  return {
    x: columnIndex * squareSize,
    y: rowIndex * squareSize,
  };
};

type ChessAppProps = {
  isTutorial?: boolean;
};

function ChessApp({ isTutorial = false }: ChessAppProps) {
  const pgn: StoredPgn | null = useStore($pgn);
  
  if (!pgn) return <div>Loading...</div>;

  const boardRef = useRef<HTMLDivElement>(null);
  const tutorialPgnRef = useRef<HTMLDivElement>(null);
  const editorPgnRef = useRef<HTMLTextAreaElement>(null);
  const colorRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  const tutorialTargets = useMemo(
    () => ({
      board: boardRef as RefObject<HTMLElement>,
      pgn: (isTutorial ? tutorialPgnRef : editorPgnRef) as RefObject<HTMLElement>,
      color: colorRef as RefObject<HTMLElement>,
      skip: skipRef as RefObject<HTMLElement>,
      hint: hintRef as RefObject<HTMLElement>,
      status: statusRef as RefObject<HTMLElement>,
    }),
    [isTutorial]
  );

  // Game settings
  const { isSkipping, setIsSkipping } = useSkipping(pgn, { persistRemotely: !isTutorial });
  const { isPlayingWhite, setIsPlayingWhite } = usePlayingColor(pgn, {
    persistRemotely: !isTutorial,
  });
  
  // Game state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [tutorialTourComplete, setTutorialTourComplete] = useState(false);
  const [hasCompletedGuidedFirstLine, setHasCompletedGuidedFirstLine] = useState(false);
  const [hasDismissedPracticePopup, setHasDismissedPracticePopup] = useState(false);
  const [isPracticePopupVisible, setIsPracticePopupVisible] = useState(false);
  const {
    currFen,
    isAutoPlaying,
    isCompleted,
    isTransitioningBetweenLines,
    isAwaitingLineAdvance,
    remainingLineCount,
    currentMoveIndex,
    moveRejectionMessage,
    onPieceDrop,
    continueToNextLine,
    showHint,
    stepBackward,
    stepForward,
  } = useLineQuizSession({
    moveText: pgn.moveText,
    isPlayingWhite,
    isSkipping,
    manualLineAdvance: isTutorial,
    onSessionComplete: () => toast.success("Game completed!"),
  });

  const tutorialFirstLineMoves = useMemo<string[]>(() => {
    if (!isTutorial) {
      return [];
    }

    const firstMainline = moveTextToMainlines(pgn.moveText)[0];
    if (!firstMainline) {
      return [];
    }

    return firstMainline.split(/\s+/).filter(Boolean);
  }, [isTutorial, pgn.moveText]);

  const tutorialGuidedMoves = useMemo<GuidedMove[]>(() => {
    if (!isTutorial || tutorialFirstLineMoves.length === 0) {
      return [];
    }

    const guidedMoves: GuidedMove[] = [];
    let whiteMoveCount = 0;

    for (let moveIndex = 0; moveIndex < tutorialFirstLineMoves.length; moveIndex++) {
      const isWhiteMove = moveIndex % 2 === 0;
      if (!isWhiteMove) {
        continue;
      }

      whiteMoveCount += 1;
      if (whiteMoveCount > MOVES_HIGHLIGHTED_IN_TUTORIAL) {
        break;
      }

      const san = tutorialFirstLineMoves[moveIndex];
      guidedMoves.push({
        moveIndex,
        san,
        instructionPrefix: san === "e4" ? "Move this pawn to" : "Play",
      });
    }

    return guidedMoves;
  }, [isTutorial, tutorialFirstLineMoves]);

  const firstUnguidedUserMoveIndex = useMemo<number | null>(() => {
    if (!isTutorial || tutorialFirstLineMoves.length === 0) {
      return null;
    }

    let whiteMoveCount = 0;
    for (let moveIndex = 0; moveIndex < tutorialFirstLineMoves.length; moveIndex++) {
      if (moveIndex % 2 !== 0) {
        continue;
      }
      whiteMoveCount += 1;
      if (whiteMoveCount === MOVES_HIGHLIGHTED_IN_TUTORIAL + 1) {
        return moveIndex;
      }
    }

    return null;
  }, [isTutorial, tutorialFirstLineMoves]);

  useEffect(() => {
    if (!isTutorial) {
      return;
    }
    setHasCompletedGuidedFirstLine(false);
    setHasDismissedPracticePopup(false);
    setIsPracticePopupVisible(false);
  }, [isTutorial, pgn.moveText]);

  useEffect(() => {
    if (!isTutorial || !tutorialTourComplete || hasCompletedGuidedFirstLine || !isAwaitingLineAdvance) {
      return;
    }
    setHasCompletedGuidedFirstLine(true);
  }, [hasCompletedGuidedFirstLine, isAwaitingLineAdvance, isTutorial, tutorialTourComplete]);

  const isTutorialMoveGuideActive =
    isTutorial && tutorialTourComplete && !hasCompletedGuidedFirstLine && !isCompleted;
  const showTutorialLineAdvancePrompt =
    isTutorial && tutorialTourComplete && isAwaitingLineAdvance && !isCompleted;
  const nextMoveIndex = currentMoveIndex + 1;
  const nextMoveIsWhite = nextMoveIndex % 2 === 0;
  const isUsersTurnByIndex = nextMoveIsWhite === isPlayingWhite;
  const shouldPromptPracticeFromPgn =
    isTutorialMoveGuideActive &&
    !hasDismissedPracticePopup &&
    !isAwaitingLineAdvance &&
    isUsersTurnByIndex &&
    firstUnguidedUserMoveIndex !== null &&
    nextMoveIndex === firstUnguidedUserMoveIndex;

  const activeGuidedMove = useMemo<GuidedMove | null>(() => {
    if (!isTutorialMoveGuideActive || !isUsersTurnByIndex || isAwaitingLineAdvance) {
      return null;
    }

    return tutorialGuidedMoves.find((guidedMove) => guidedMove.moveIndex === nextMoveIndex) ?? null;
  }, [isAwaitingLineAdvance, isTutorialMoveGuideActive, isUsersTurnByIndex, nextMoveIndex, tutorialGuidedMoves]);

  const activeGuidedMoveContext = useMemo<
    (GuidedMove & { sourceSquare: string; targetSquare: string }) | null
  >(() => {
    if (!activeGuidedMove) {
      return null;
    }

    const previewChess = new Chess(currFen);
    const previewMove = previewChess.move(activeGuidedMove.san);
    if (!previewMove) {
      return null;
    }

    return {
      ...activeGuidedMove,
      sourceSquare: previewMove.from,
      targetSquare: previewMove.to,
    };
  }, [activeGuidedMove, currFen]);

  const highlightedPgnMoveSan = activeGuidedMoveContext?.san ?? null;

  const tutorialPgnSegments = useMemo<HighlightedTextSegment[]>(() => {
    const moveText = pgn?.moveText || "";
    if (!isTutorial || moveText.length === 0) {
      return [{ key: "raw", text: moveText, isHighlighted: false }];
    }

    const tokens = moveText.split(/(\s+)/);
    let hasHighlightedToken = false;

    return tokens.map((token, index) => {
      const isWhitespace = token.trim().length === 0;
      const isHighlightMatch =
        !isWhitespace &&
        !hasHighlightedToken &&
        highlightedPgnMoveSan !== null &&
        stripMoveAnnotation(token) === highlightedPgnMoveSan;

      if (isHighlightMatch) {
        hasHighlightedToken = true;
      }

      return {
        key: `${index}-${token}`,
        text: token,
        isHighlighted: isHighlightMatch,
      };
    });
  }, [highlightedPgnMoveSan, isTutorial, pgn?.moveText]);

  const isTutorialInteractionLocked =
    isTutorialMoveGuideActive || showTutorialLineAdvancePrompt || isPracticePopupVisible;

  const handlePieceDrop = useCallback(
    (sourceSquare: string, targetSquare: string) => {
      if (isPracticePopupVisible) {
        return false;
      }
      return onPieceDrop(sourceSquare, targetSquare);
    },
    [isPracticePopupVisible, onPieceDrop]
  );

  const dismissPracticePopup = useCallback(() => {
    setIsPracticePopupVisible(false);
    setHasDismissedPracticePopup(true);
  }, []);

  useEffect(() => {
    if (!shouldPromptPracticeFromPgn) {
      return;
    }

    setIsPracticePopupVisible(true);
  }, [shouldPromptPracticeFromPgn]);

  useEffect(() => {
    if (!isTutorialMoveGuideActive) {
      return;
    }

    if (!isPlayingWhite) {
      setIsPlayingWhite(true);
    }

    if (isSkipping) {
      setIsSkipping(false);
    }
  }, [isPlayingWhite, isSkipping, isTutorialMoveGuideActive, setIsPlayingWhite, setIsSkipping]);

  const [showCelebrationAnimation, setShowCelebrationAnimation] = useState(false);
  const [boardFrame, setBoardFrame] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!isCompleted) {
      setShowCelebrationAnimation(false);
      return;
    }

    setShowCelebrationAnimation(true);
    const timeoutId = window.setTimeout(() => {
      setShowCelebrationAnimation(false);
    }, 2800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isCompleted]);

  useEffect(() => {
    const boardNode = boardRef.current;
    if (!boardNode) {
      return undefined;
    }

    const updateBoardFrame = () => {
      const rect = boardNode.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);

      setBoardFrame((previous) => {
        if (previous.width === width && previous.height === height) {
          return previous;
        }
        return { width, height };
      });
    };

    updateBoardFrame();
    const resizeObserver = new ResizeObserver(updateBoardFrame);
    resizeObserver.observe(boardNode);
    window.addEventListener("resize", updateBoardFrame);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateBoardFrame);
    };
  }, []);

  const tutorialPawnSpotlightLayout = useMemo<SpotlightLayout | null>(() => {
    if (!activeGuidedMoveContext) {
      return null;
    }

    const boardSize = Math.min(boardFrame.width, boardFrame.height);
    if (boardSize <= 0) {
      return null;
    }

    const squareSize = boardSize / 8;
    const squareTopLeft = getSquareTopLeft(activeGuidedMoveContext.sourceSquare, isPlayingWhite, squareSize);
    if (!squareTopLeft) {
      return null;
    }

    const holeSize = Math.min(squareSize - 4, Math.max(28, squareSize * 0.86));
    const holeX = squareTopLeft.x + (squareSize - holeSize) / 2;
    const holeY = squareTopLeft.y + (squareSize - holeSize) / 2;
    const noteWidth = Math.min(220, Math.max(156, boardSize * 0.32));
    let noteLeft = holeX + holeSize + 12;
    if (noteLeft + noteWidth > boardSize - 8) {
      noteLeft = holeX - noteWidth - 12;
    }
    const noteTop = Math.max(8, Math.min(boardSize - 56, holeY + holeSize / 2 - 20));

    return {
      boardSize,
      holeX,
      holeY,
      holeSize,
      noteLeft,
      noteTop,
      noteWidth,
    };
  }, [activeGuidedMoveContext, boardFrame.height, boardFrame.width, isPlayingWhite]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (isTutorialInteractionLocked) {
        return;
      }
      if (event.key === "ArrowRight") {
        stepForward();
      } else if (event.key === "ArrowLeft") {
        stepBackward();
      }
    },
    [isTutorialInteractionLocked, stepBackward, stepForward]
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
        "flex gap-4 justify-center items-center w-full h-[100vh]"
      )}>
        {/* Board */}
        <div ref={boardRef} className="relative" style={{ width: 'min(80vh, 70vw)' }}>
          <Board
            currFen={currFen} 
            onPieceDrop={handlePieceDrop}
            isWhite={isPlayingWhite}
          />
          <LessonCompleteCelebration
            isCompleted={isCompleted}
            showAnimation={showCelebrationAnimation}
          />
          <LineTransitionCelebration isVisible={isTransitioningBetweenLines && !isCompleted} />
          {isTutorial && !tutorialTourComplete && (
            <TutorialCoachmarks
              targets={tutorialTargets}
              onComplete={() => setTutorialTourComplete(true)}
            />
          )}
          {tutorialPawnSpotlightLayout && (
            <div className="absolute inset-0 pointer-events-none tutorial-pawn-spotlight-layer" aria-hidden="true">
              <div
                className="tutorial-pawn-spotlight-mask"
                style={{ left: 0, top: 0, width: "100%", height: tutorialPawnSpotlightLayout.holeY }}
              />
              <div
                className="tutorial-pawn-spotlight-mask"
                style={{
                  left: 0,
                  top: tutorialPawnSpotlightLayout.holeY,
                  width: tutorialPawnSpotlightLayout.holeX,
                  height: tutorialPawnSpotlightLayout.holeSize,
                }}
              />
              <div
                className="tutorial-pawn-spotlight-mask"
                style={{
                  left: tutorialPawnSpotlightLayout.holeX + tutorialPawnSpotlightLayout.holeSize,
                  top: tutorialPawnSpotlightLayout.holeY,
                  width: Math.max(
                    0,
                    tutorialPawnSpotlightLayout.boardSize -
                      (tutorialPawnSpotlightLayout.holeX + tutorialPawnSpotlightLayout.holeSize)
                  ),
                  height: tutorialPawnSpotlightLayout.holeSize,
                }}
              />
              <div
                className="tutorial-pawn-spotlight-mask"
                style={{
                  left: 0,
                  top: tutorialPawnSpotlightLayout.holeY + tutorialPawnSpotlightLayout.holeSize,
                  width: "100%",
                  height: Math.max(
                    0,
                    tutorialPawnSpotlightLayout.boardSize -
                      (tutorialPawnSpotlightLayout.holeY + tutorialPawnSpotlightLayout.holeSize)
                  ),
                }}
              />
              <div
                className="tutorial-pawn-spotlight-hole"
                style={{
                  left: tutorialPawnSpotlightLayout.holeX,
                  top: tutorialPawnSpotlightLayout.holeY,
                  width: tutorialPawnSpotlightLayout.holeSize,
                  height: tutorialPawnSpotlightLayout.holeSize,
                }}
              />
              <div
                className="tutorial-pawn-spotlight-note"
                style={{
                  left: tutorialPawnSpotlightLayout.noteLeft,
                  top: tutorialPawnSpotlightLayout.noteTop,
                  width: tutorialPawnSpotlightLayout.noteWidth,
                }}
              >
                {activeGuidedMoveContext?.instructionPrefix}{" "}
                <strong>{activeGuidedMoveContext?.san}</strong>.
              </div>
            </div>
          )}
          {showTutorialLineAdvancePrompt && (
            <div className="tutorial-line-advance-card">
              <p className="tutorial-line-advance-title">Line complete!</p>
              {remainingLineCount && (
                <p className="tutorial-line-advance-body">
                  {`Another ${remainingLineCount > 1 ? `${remainingLineCount} lines` : "line"} left`}
                </p>
              )}
              <button type="button" className="tutorial-line-advance-btn" onClick={continueToNextLine}>
                Start next line
              </button>
            </div>
          )}
          {isPracticePopupVisible && (
            <div className="tutorial-practice-popup-layer">
              <div className="tutorial-practice-popup-card">
                <p className="tutorial-practice-popup-text">Now practice the rest from the pgn uploaded!</p>
                <button type="button" className="tutorial-practice-popup-btn" onClick={dismissPracticePopup}>
                  Continue
                </button>
              </div>
            </div>
          )}
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
            <div className="flex flex-row gap-4 items-center w-full justify-left">
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
              className="p-2 w-full rounded border border-gray-300 h-fit"
              placeholder="Notes"
            />
            {isTutorial ? (
              <div
                ref={tutorialPgnRef}
                className="flex-grow p-2 w-full h-full rounded border border-gray-300 tutorial-pgn-display"
                role="textbox"
                aria-readonly="true"
                aria-label="PGN"
              >
                {tutorialPgnSegments.map((segment) => (
                  <span
                    key={segment.key}
                    className={segment.isHighlighted ? "tutorial-pgn-token-highlight" : undefined}
                  >
                    {segment.text}
                  </span>
                ))}
              </div>
            ) : (
              <textarea
                ref={editorPgnRef}
                value={pgn?.moveText || ''}
                className="flex-grow p-2 w-full h-full rounded border border-gray-300"
                placeholder="PGN"
                readOnly={false}
              />
            )}
          </div>
          
          {/* Game Settings */}
          <div ref={colorRef} className="flex flex-row gap-2 justify-center items-center">
            Play as:
            <button 
              className={`w-[25px] h-[25px] bg-[var(--board-light)] rounded-md ${isPlayingWhite ? 'border-2 border-[#827662]' : ''} box-border`} 
              disabled={isTutorialInteractionLocked}
              onClick={() => setIsPlayingWhite(true)}
            ></button>
            <button 
              className={`w-[25px] h-[25px] bg-[var(--board-dark)] rounded-md ${!isPlayingWhite ? 'border-2 border-[#827662]' : ''} box-border`} 
              disabled={isTutorialInteractionLocked}
              onClick={() => setIsPlayingWhite(false)}
            ></button>
          </div>
          <div ref={skipRef} className="flex flex-row gap-2 justify-center items-center">
            Skip to first branch:
            <button 
              disabled={isTutorialInteractionLocked}
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
            ref={hintRef}
            className="p-2 w-full rounded border border-gray-300 hover:bg-gray-100"
            onClick={showHint}
            disabled={isAutoPlaying || isCompleted || isTutorialInteractionLocked}
          >
            Hint
          </button>

          <div
            ref={statusRef}
            className={cn(
              "px-3 py-2 w-full text-sm font-semibold text-center rounded border",
              isCompleted
                ? "border-emerald-500 bg-emerald-100/80"
                : "bg-[var(--background-beige-dark)] border-[var(--beige-outline)]"
            )}
          >
            {isCompleted
              ? "Lesson complete: all lines covered."
              : showTutorialLineAdvancePrompt
                ? "Line finished: continue when ready."
                : "Lesson in progress"}
          </div>

          {moveRejectionMessage && (
            <div className="px-3 py-2 w-full text-sm font-medium text-center text-amber-900 rounded border border-amber-500 bg-amber-100/80">
              {moveRejectionMessage}
            </div>
          )}
        </div>
      </div>
      {pgn && !isTutorial && (
        <EditPgnDialog pgn={pgn} open={editDialogOpen} setEditDialogOpen={setEditDialogOpen} />
      )}
    </>
  );
}

export default ChessApp;
