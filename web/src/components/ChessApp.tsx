import { RefObject, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
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
import {
  HIGHLIGHT_DESTINATION_SQUARE_IN_TUTORIAL_IN_NON_BRANCHING_POSITIONS,
  MOVES_HIGHLIGHTED_IN_TUTORIAL,
} from "@/constants";

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

type TutorialMoveContext = {
  moveIndex: number;
  san: string;
  sourceSquare: string;
  targetSquare: string;
  instructionPrefix: string;
};

type SpotlightHole = {
  x: number;
  y: number;
  size: number;
};

type SpotlightLayout = {
  boardSize: number;
  holes: SpotlightHole[];
  noteLeft: number;
  noteTop: number;
  noteWidth: number;
};

type HighlightedTextSegment = {
  key: string;
  text: string;
  isHighlighted: boolean;
};

const stripMoveAnnotation = (token: string): string =>
  token.replace(/^[([{]+/, "").replace(/[)\]}]+$/, "").replace(/[!?+#]+$/g, "");
const normalizeFen = (fen: string): string => fen.split(" ").slice(0, 4).join(" ");

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
  const spotlightMaskId = useId().replace(/:/g, "");

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
  const [isBranchPopupVisible, setIsBranchPopupVisible] = useState(false);
  const [branchHighlightsDismissedCount, setBranchHighlightsDismissedCount] = useState(0);
  const [branchPopupPositionKey, setBranchPopupPositionKey] = useState<string | null>(null);
  const [branchPopupIsUsersTurn, setBranchPopupIsUsersTurn] = useState(false);
  const latestBranchOccurrenceKeyRef = useRef<string | null>(null);
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
    isPaused: isPracticePopupVisible || isBranchPopupVisible,
    randomizeOpponentBranchMoves: isTutorial,
    manualLineAdvance: isTutorial,
    onSessionComplete: () => toast.success("Game completed!"),
  });

  const tutorialMainlineMoves = useMemo<string[][]>(() => {
    if (!isTutorial) {
      return [];
    }

    return moveTextToMainlines(pgn.moveText).map((line) => line.split(/\s+/).filter(Boolean));
  }, [isTutorial, pgn.moveText]);

  const tutorialFirstLineMoves = tutorialMainlineMoves[0] ?? [];

  const branchMoveOptionsByPosition = useMemo<Map<string, string[]>>(() => {
    if (!isTutorial || tutorialMainlineMoves.length <= 1) {
      return new Map();
    }

    const positionToMoves = new Map<string, Set<string>>();

    for (const lineMoves of tutorialMainlineMoves) {
      const chess = new Chess();
      for (let moveIndex = 0; moveIndex < lineMoves.length; moveIndex++) {
        const positionKey = `${moveIndex}|${normalizeFen(chess.fen())}`;
        const nextSan = lineMoves[moveIndex];

        let candidateMoves = positionToMoves.get(positionKey);
        if (!candidateMoves) {
          candidateMoves = new Set<string>();
          positionToMoves.set(positionKey, candidateMoves);
        }
        candidateMoves.add(nextSan);

        if (!chess.move(nextSan)) {
          break;
        }
      }
    }

    const branchOptions = new Map<string, string[]>();
    for (const [positionKey, candidateMoves] of positionToMoves.entries()) {
      if (candidateMoves.size > 1) {
        branchOptions.set(positionKey, Array.from(candidateMoves));
      }
    }

    return branchOptions;
  }, [isTutorial, tutorialMainlineMoves]);

  const branchPositionKeys = useMemo<Set<string>>(
    () => new Set(branchMoveOptionsByPosition.keys()),
    [branchMoveOptionsByPosition]
  );

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
    setIsBranchPopupVisible(false);
    setBranchHighlightsDismissedCount(0);
    setBranchPopupPositionKey(null);
    setBranchPopupIsUsersTurn(false);
    latestBranchOccurrenceKeyRef.current = null;
  }, [isTutorial, pgn.moveText]);

  useEffect(() => {
    if (!isTutorial || !tutorialTourComplete || hasCompletedGuidedFirstLine || !isAwaitingLineAdvance) {
      return;
    }
    setHasCompletedGuidedFirstLine(true);
  }, [hasCompletedGuidedFirstLine, isAwaitingLineAdvance, isTutorial, tutorialTourComplete]);

  const isTutorialMoveGuideActive =
    isTutorial && tutorialTourComplete && !hasCompletedGuidedFirstLine && !isCompleted;
  const isTutorialBranchGuideActive = isTutorial && tutorialTourComplete && !isCompleted;
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
  const currentBranchPositionKey = `${nextMoveIndex}|${normalizeFen(currFen)}`;
  const hasBranchOptionsAtCurrentPosition = branchPositionKeys.has(currentBranchPositionKey);
  const currentBranchOccurrenceKey =
    isTutorialBranchGuideActive &&
    !isAwaitingLineAdvance &&
    !isPracticePopupVisible &&
    hasBranchOptionsAtCurrentPosition
      ? currentBranchPositionKey
      : null;
  const shouldHighlightDestinationSquareInTutorial =
    HIGHLIGHT_DESTINATION_SQUARE_IN_TUTORIAL_IN_NON_BRANCHING_POSITIONS &&
    !isBranchPopupVisible &&
    isTutorialMoveGuideActive &&
    isUsersTurnByIndex &&
    !hasBranchOptionsAtCurrentPosition;

  const activeGuidedMove = useMemo<GuidedMove | null>(() => {
    if (!isTutorialMoveGuideActive || !isUsersTurnByIndex || isAwaitingLineAdvance) {
      return null;
    }

    return tutorialGuidedMoves.find((guidedMove) => guidedMove.moveIndex === nextMoveIndex) ?? null;
  }, [isAwaitingLineAdvance, isTutorialMoveGuideActive, isUsersTurnByIndex, nextMoveIndex, tutorialGuidedMoves]);

  const activeGuidedMoveContext = useMemo<TutorialMoveContext | null>(() => {
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

  const currentBranchMoveContexts = useMemo<TutorialMoveContext[]>(() => {
    if (!currentBranchOccurrenceKey) {
      return [];
    }

    const branchMoveSans = branchMoveOptionsByPosition.get(currentBranchOccurrenceKey) ?? [];
    return branchMoveSans.flatMap((san) => {
      const previewChess = new Chess(currFen);
      const previewMove = previewChess.move(san);
      if (!previewMove) {
        return [];
      }

      return [
        {
          moveIndex: nextMoveIndex,
          san,
          sourceSquare: previewMove.from,
          targetSquare: previewMove.to,
          instructionPrefix: isUsersTurnByIndex ? "Play" : "Watch for",
        },
      ];
    });
  }, [
    branchMoveOptionsByPosition,
    currFen,
    currentBranchOccurrenceKey,
    isUsersTurnByIndex,
    nextMoveIndex,
  ]);

  const branchPopupMoveContexts = useMemo<TutorialMoveContext[]>(() => {
    if (!isBranchPopupVisible || !branchPopupPositionKey) {
      return [];
    }

    const branchMoveSans = branchMoveOptionsByPosition.get(branchPopupPositionKey) ?? [];
    const parsedMoveIndex = Number.parseInt(branchPopupPositionKey.split("|")[0] ?? "", 10);
    const popupMoveIndex = Number.isNaN(parsedMoveIndex) ? nextMoveIndex : parsedMoveIndex;

    return branchMoveSans.flatMap((san) => {
      const previewChess = new Chess(currFen);
      const previewMove = previewChess.move(san);
      if (!previewMove) {
        return [];
      }

      return [
        {
          moveIndex: popupMoveIndex,
          san,
          sourceSquare: previewMove.from,
          targetSquare: previewMove.to,
          instructionPrefix: branchPopupIsUsersTurn ? "Play" : "Watch for",
        },
      ];
    });
  }, [
    branchMoveOptionsByPosition,
    branchPopupIsUsersTurn,
    branchPopupPositionKey,
    currFen,
    isBranchPopupVisible,
    nextMoveIndex,
  ]);

  const activeSpotlightMoveContexts = useMemo<TutorialMoveContext[]>(() => {
    if (isBranchPopupVisible) {
      return branchPopupMoveContexts;
    }

    if (activeGuidedMoveContext) {
      return [activeGuidedMoveContext];
    }

    return [];
  }, [activeGuidedMoveContext, branchPopupMoveContexts, isBranchPopupVisible]);

  const activeSpotlightMoveContext = isBranchPopupVisible ? null : activeGuidedMoveContext;
  const branchPopupOptionCount = branchPopupMoveContexts.length;
  const branchPopupTitle =
    branchHighlightsDismissedCount === 0 ? "Branching move" : "Branching move again";
  const branchPopupMessage = useMemo(() => {
    if (branchPopupOptionCount === 0) {
      return "";
    }

    const isFirstBranchPopup = branchHighlightsDismissedCount === 0;
    const remainingOptions = Math.max(branchPopupOptionCount - 1, 0);
    const remainingOptionsLabel =
      remainingOptions === 1 ? "the remaining move" : `the remaining ${remainingOptions} moves`;

    if (branchPopupIsUsersTurn) {
      if (isFirstBranchPopup) {
        if (branchPopupOptionCount > 2) {
          return `The PGN branches here into ${branchPopupOptionCount} options for you. Play any highlighted move now, and we will return for the others.`;
        }
        return "The PGN branches here into 2 options for you. Play either highlighted move now, then play the other one next time.";
      }

      if (branchPopupOptionCount > 2) {
        return `You are back at the same branch. Choose a different highlighted move this time to cover ${remainingOptionsLabel}.`;
      }
      return "You are back at the same branch. Choose the other highlighted move this time so both lines are covered.";
    }

    if (isFirstBranchPopup) {
      if (branchPopupOptionCount > 2) {
        return `The PGN branches here into ${branchPopupOptionCount} opponent options. Your opponent can play any highlighted move, and one will be selected at random each time.`;
      }
      return "The PGN branches here into 2 opponent options. Your opponent can play either highlighted move, and one will be selected at random.";
    }

    if (branchPopupOptionCount > 2) {
      return `You are seeing this branch again. Your opponent will now play one of the other ${remainingOptionsLabel} so that we can explore all the lines.`;
    }
    return "You are seeing this branch again. Your opponent will now play the other move so that we can explore all the lines.";
  }, [branchHighlightsDismissedCount, branchPopupIsUsersTurn, branchPopupOptionCount]);

  const highlightedBranchSans = useMemo<Set<string> | null>(() => {
    if (!isBranchPopupVisible || branchPopupMoveContexts.length === 0) {
      return null;
    }

    return new Set(branchPopupMoveContexts.map((context) => context.san));
  }, [branchPopupMoveContexts, isBranchPopupVisible]);
  const highlightedPgnMoveSan = activeSpotlightMoveContext?.san ?? null;

  const tutorialPgnSegments = useMemo<HighlightedTextSegment[]>(() => {
    const moveText = pgn?.moveText || "";
    if (!isTutorial || moveText.length === 0) {
      return [{ key: "raw", text: moveText, isHighlighted: false }];
    }

    const tokens = moveText.split(/(\s+)/);
    let hasHighlightedToken = false;
    const unmatchedBranchSans = highlightedBranchSans ? new Set(highlightedBranchSans) : null;

    return tokens.map((token, index) => {
      const isWhitespace = token.trim().length === 0;
      const sanitizedToken = stripMoveAnnotation(token);
      let isHighlightMatch = false;

      if (!isWhitespace && unmatchedBranchSans && unmatchedBranchSans.has(sanitizedToken)) {
        isHighlightMatch = true;
        unmatchedBranchSans.delete(sanitizedToken);
      } else if (
        !isWhitespace &&
        !unmatchedBranchSans &&
        !hasHighlightedToken &&
        highlightedPgnMoveSan !== null &&
        sanitizedToken === highlightedPgnMoveSan
      ) {
        isHighlightMatch = true;
      }

      if (isHighlightMatch) {
        hasHighlightedToken = true;
      }

      return {
        key: `${index}-${token}`,
        text: token,
        isHighlighted: isHighlightMatch,
      };
    });
  }, [highlightedBranchSans, highlightedPgnMoveSan, isTutorial, pgn?.moveText]);

  const isTutorialInteractionLocked =
    isTutorialMoveGuideActive ||
    showTutorialLineAdvancePrompt ||
    isPracticePopupVisible ||
    isBranchPopupVisible;

  const handlePieceDrop = useCallback(
    (sourceSquare: string, targetSquare: string) => {
      if (isPracticePopupVisible || isBranchPopupVisible) {
        return false;
      }
      return onPieceDrop(sourceSquare, targetSquare);
    },
    [isBranchPopupVisible, isPracticePopupVisible, onPieceDrop]
  );

  const dismissPracticePopup = useCallback(() => {
    setIsPracticePopupVisible(false);
    setHasDismissedPracticePopup(true);
  }, []);

  const dismissBranchPopup = useCallback(() => {
    setIsBranchPopupVisible(false);
    setBranchHighlightsDismissedCount((count) => count + 1);
    setBranchPopupPositionKey(null);
  }, []);

  useEffect(() => {
    if (!shouldPromptPracticeFromPgn) {
      return;
    }

    setIsPracticePopupVisible(true);
  }, [shouldPromptPracticeFromPgn]);

  useEffect(() => {
    if (!currentBranchOccurrenceKey || currentBranchMoveContexts.length === 0) {
      latestBranchOccurrenceKeyRef.current = null;
      return;
    }

    if (latestBranchOccurrenceKeyRef.current === currentBranchOccurrenceKey) {
      return;
    }
    latestBranchOccurrenceKeyRef.current = currentBranchOccurrenceKey;

    if (branchHighlightsDismissedCount >= 2 || isBranchPopupVisible) {
      return;
    }

    setBranchPopupPositionKey(currentBranchOccurrenceKey);
    setBranchPopupIsUsersTurn(isUsersTurnByIndex);
    setIsBranchPopupVisible(true);
  }, [
    branchHighlightsDismissedCount,
    currentBranchMoveContexts.length,
    currentBranchOccurrenceKey,
    isBranchPopupVisible,
    isUsersTurnByIndex,
  ]);

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

  const tutorialSpotlightLayout = useMemo<SpotlightLayout | null>(() => {
    if (activeSpotlightMoveContexts.length === 0) {
      return null;
    }

    const boardSize = Math.min(boardFrame.width, boardFrame.height);
    if (boardSize <= 0) {
      return null;
    }

    const squareSize = boardSize / 8;
    const spotlightSquares = new Set<string>();
    for (const moveContext of activeSpotlightMoveContexts) {
      spotlightSquares.add(moveContext.sourceSquare);
      if (shouldHighlightDestinationSquareInTutorial) {
        spotlightSquares.add(moveContext.targetSquare);
      }
    }

    const sourceSquares = Array.from(spotlightSquares);
    const holeSize = squareSize;
    const holes = sourceSquares.flatMap((sourceSquare) => {
      const squareTopLeft = getSquareTopLeft(sourceSquare, isPlayingWhite, squareSize);
      if (!squareTopLeft) {
        return [];
      }

      return [
        {
          x: squareTopLeft.x,
          y: squareTopLeft.y,
          size: holeSize,
        },
      ];
    });

    if (holes.length === 0) {
      return null;
    }

    const primaryHole = holes[0];
    const noteWidth = Math.min(220, Math.max(156, boardSize * 0.32));
    let noteLeft = primaryHole.x + primaryHole.size + 12;
    if (noteLeft + noteWidth > boardSize - 8) {
      noteLeft = primaryHole.x - noteWidth - 12;
    }
    const noteTop = Math.max(8, Math.min(boardSize - 56, primaryHole.y + primaryHole.size / 2 - 20));

    return {
      boardSize,
      holes,
      noteLeft,
      noteTop,
      noteWidth,
    };
  }, [
    activeSpotlightMoveContexts,
    boardFrame.height,
    boardFrame.width,
    isPlayingWhite,
    shouldHighlightDestinationSquareInTutorial,
  ]);

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
          {tutorialSpotlightLayout && (
            <div className="absolute inset-0 pointer-events-none tutorial-pawn-spotlight-layer" aria-hidden="true">
              <svg
                className="tutorial-spotlight-svg"
                viewBox={`0 0 ${tutorialSpotlightLayout.boardSize} ${tutorialSpotlightLayout.boardSize}`}
                preserveAspectRatio="none"
              >
                <defs>
                  <mask id={spotlightMaskId}>
                    <rect
                      x={0}
                      y={0}
                      width={tutorialSpotlightLayout.boardSize}
                      height={tutorialSpotlightLayout.boardSize}
                      fill="#fff"
                    />
                    {tutorialSpotlightLayout.holes.map((hole, index) => (
                      <rect
                        key={`spotlight-hole-${index}`}
                        x={hole.x}
                        y={hole.y}
                        width={hole.size}
                        height={hole.size}
                        rx={Math.max(6, Math.min(12, hole.size * 0.14))}
                        fill="#000"
                      />
                    ))}
                  </mask>
                </defs>
                <rect
                  className="tutorial-pawn-spotlight-mask"
                  x={0}
                  y={0}
                  width={tutorialSpotlightLayout.boardSize}
                  height={tutorialSpotlightLayout.boardSize}
                  mask={`url(#${spotlightMaskId})`}
                />
              </svg>
              {activeSpotlightMoveContext && (
                <div
                  className="tutorial-pawn-spotlight-note"
                  style={{
                    left: tutorialSpotlightLayout.noteLeft,
                    top: tutorialSpotlightLayout.noteTop,
                    width: tutorialSpotlightLayout.noteWidth,
                  }}
                >
                  {activeSpotlightMoveContext.instructionPrefix}{" "}
                  <strong>{activeSpotlightMoveContext.san}</strong>.
                </div>
              )}
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
          {isBranchPopupVisible && (
            <div className="tutorial-practice-popup-layer">
              <div className="tutorial-practice-popup-card">
                <p className="tutorial-practice-popup-title">{branchPopupTitle}</p>
                <p className="tutorial-practice-popup-body">{branchPopupMessage}</p>
                <button type="button" className="tutorial-practice-popup-btn" onClick={dismissBranchPopup}>
                  Continue
                </button>
              </div>
            </div>
          )}
          {isPracticePopupVisible && (
            <div className="tutorial-practice-popup-layer">
              <div className="tutorial-practice-popup-card">
                <p className="tutorial-practice-popup-title">Practice checkpoint</p>
                <p className="tutorial-practice-popup-body">Now practice the rest from the pgn uploaded!</p>
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
