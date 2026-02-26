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
import useMutationPgns from "@/hooks/useMutationPgns";
import LessonCompleteCelebration from "@/components/LessonCompleteCelebration";
import LineTransitionCelebration from "@/components/LineTransitionCelebration";
import TutorialCoachmarks from "@/components/TutorialCoachmarks";
import {
  moveTextToDisplayTokens,
  moveTextToMainlines,
  toPgnMoveOccurrenceKey,
} from "@/utils/chess/pgn-parser";
import {
  BUFFFER_TIME_BETWEEN_USER_AND_OPPONENT_MOVE,
  CONTINUE_HIGHLIGHTING_PGN_MOVES_THROUOUGHT_TUTORIAL,
  DESTINATION_SQUARE_SPOTLIGHT_BRIGHTNESS_DEGRADATION_FACTOR,
  HIGHLIGHT_DESTINATION_SQUARE_IN_TUTORIAL_IN_NON_BRANCHING_POSITIONS,
  LENGTH_OF_OPPONENT_MOVE,
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
  maskFill: string;
};

type SpotlightLayout = {
  boardSize: number;
  holes: SpotlightHole[];
  noteLeft: number;
  noteTop: number;
  noteWidth: number;
};

type ViewportRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type HighlightedTextSegment = {
  key: string;
  text: string;
  isHighlighted: boolean;
};

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
  const { updatePgnContent } = useMutationPgns();
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
  const [isMoveHighlightingEnabled, setIsMoveHighlightingEnabled] = useState(true);
  const [highlightedPgnTokenRect, setHighlightedPgnTokenRect] = useState<ViewportRect | null>(null);
  const latestBranchOccurrenceKeyRef = useRef<string | null>(null);
  const updatePgnContentRef = useRef(updatePgnContent);
  const persistedVisitedNodeHashesKeyRef = useRef("");
  const hasResetPersistedOnCompleteRef = useRef(false);
  const initialVisitedNodeHashes = useMemo(
    () => (isTutorial ? [] : pgn.gameProgress?.visitedNodeHashes ?? []),
    [isTutorial, pgn.gameProgress?.visitedNodeHashes]
  );
  const normalizedInitialVisitedNodeHashes = useMemo(
    () => Array.from(new Set(initialVisitedNodeHashes.filter(Boolean))).sort(),
    [initialVisitedNodeHashes]
  );
  const normalizedVisitedNodeHashesKey = useMemo(
    () => normalizedInitialVisitedNodeHashes.join("|"),
    [normalizedInitialVisitedNodeHashes]
  );
  const {
    currFen,
    isAutoPlaying,
    isCompleted,
    visitedNodeHashes,
    isTransitioningBetweenLines,
    isAwaitingLineAdvance,
    remainingLineCount,
    currentMoveIndex,
    nextExpectedMoveSan,
    nextMovePositionKey,
    recentAutoMoveOccurrenceKey,
    moveRejectionMessage,
    onPieceDrop,
    continueToNextLine,
    showHint,
    stepBackward,
    stepForward,
    restartSession,
  } = useLineQuizSession({
    moveText: pgn.moveText,
    isPlayingWhite,
    isSkipping,
    initialVisitedNodeHashes: normalizedInitialVisitedNodeHashes,
    isPaused: isPracticePopupVisible || isBranchPopupVisible,
    randomizeOpponentBranchMoves: isTutorial,
    manualLineAdvance: isTutorial,
    onSessionComplete: () => toast.success("Game completed!"),
  });
  const normalizedVisitedNodeHashes = useMemo(
    () => Array.from(new Set(visitedNodeHashes.filter(Boolean))).sort(),
    [visitedNodeHashes]
  );
  const normalizedVisitedNodeHashesProgressKey = useMemo(
    () => normalizedVisitedNodeHashes.join("|"),
    [normalizedVisitedNodeHashes]
  );

  useEffect(() => {
    updatePgnContentRef.current = updatePgnContent;
  }, [updatePgnContent]);

  useEffect(() => {
    persistedVisitedNodeHashesKeyRef.current = normalizedVisitedNodeHashesKey;
  }, [normalizedVisitedNodeHashesKey, pgn._id]);

  useEffect(() => {
    if (isTutorial || !pgn._id || pgn._id === "tutorial") {
      return;
    }

    if (isCompleted) {
      return;
    }

    if (normalizedVisitedNodeHashesProgressKey === persistedVisitedNodeHashesKeyRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        const didPersist = await updatePgnContentRef.current(pgn._id, {
          gameProgress: {
            visitedNodeHashes: normalizedVisitedNodeHashes,
          },
        });
        if (didPersist) {
          persistedVisitedNodeHashesKeyRef.current = normalizedVisitedNodeHashesProgressKey;
        }
      })();
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    isCompleted,
    isTutorial,
    normalizedVisitedNodeHashes,
    normalizedVisitedNodeHashesProgressKey,
    pgn._id,
  ]);

  useEffect(() => {
    if (isTutorial || !pgn._id || pgn._id === "tutorial") {
      hasResetPersistedOnCompleteRef.current = false;
      return;
    }

    if (!isCompleted) {
      hasResetPersistedOnCompleteRef.current = false;
      return;
    }

    if (hasResetPersistedOnCompleteRef.current) {
      return;
    }
    hasResetPersistedOnCompleteRef.current = true;

    void (async () => {
      const didPersist = await updatePgnContentRef.current(pgn._id, {
        gameProgress: {
          visitedNodeHashes: [],
        },
      });

      if (didPersist) {
        persistedVisitedNodeHashesKeyRef.current = "";
      } else {
        hasResetPersistedOnCompleteRef.current = false;
      }
    })();
  }, [isCompleted, isTutorial, pgn._id]);

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
      for (let moveIndex = 0; moveIndex < lineMoves.length; moveIndex++) {
        const positionKey = `${moveIndex}|${lineMoves.slice(0, moveIndex).join(" ")}`;
        const nextSan = lineMoves[moveIndex];

        let candidateMoves = positionToMoves.get(positionKey);
        if (!candidateMoves) {
          candidateMoves = new Set<string>();
          positionToMoves.set(positionKey, candidateMoves);
        }
        candidateMoves.add(nextSan);
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
    setIsMoveHighlightingEnabled(true);
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
  const currentBranchPositionKey = nextMovePositionKey;
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

  const persistedBranchHighlightOccurrenceKeys = useMemo<Set<string> | null>(() => {
    if (
      !isTutorial ||
      !CONTINUE_HIGHLIGHTING_PGN_MOVES_THROUOUGHT_TUTORIAL ||
      !isUsersTurnByIndex ||
      !hasBranchOptionsAtCurrentPosition
    ) {
      return null;
    }

    const branchMoveSans = branchMoveOptionsByPosition.get(currentBranchPositionKey) ?? [];
    if (branchMoveSans.length <= 1) {
      return null;
    }

    return new Set(
      branchMoveSans.map((san) => toPgnMoveOccurrenceKey(currentBranchPositionKey, san))
    );
  }, [
    branchMoveOptionsByPosition,
    currentBranchPositionKey,
    hasBranchOptionsAtCurrentPosition,
    isTutorial,
    isUsersTurnByIndex,
  ]);

  const highlightedBranchOccurrenceKeys = useMemo<Set<string> | null>(() => {
    if (isBranchPopupVisible && branchPopupPositionKey) {
      const popupBranchMoveSans = branchMoveOptionsByPosition.get(branchPopupPositionKey) ?? [];
      if (popupBranchMoveSans.length === 0) {
        return null;
      }

      return new Set(
        popupBranchMoveSans.map((san) => toPgnMoveOccurrenceKey(branchPopupPositionKey, san))
      );
    }

    return persistedBranchHighlightOccurrenceKeys;
  }, [
    branchMoveOptionsByPosition,
    branchPopupPositionKey,
    isBranchPopupVisible,
    persistedBranchHighlightOccurrenceKeys,
  ]);
  const isPgnMoveHighlightingEnabled = isTutorial || isMoveHighlightingEnabled;
  const shouldContinuePgnMoveHighlighting =
    isPgnMoveHighlightingEnabled &&
    (!isTutorial || CONTINUE_HIGHLIGHTING_PGN_MOVES_THROUOUGHT_TUTORIAL) &&
    !isAwaitingLineAdvance;
  const totalOpponentMoveHoverDurationMs =
    BUFFFER_TIME_BETWEEN_USER_AND_OPPONENT_MOVE + LENGTH_OF_OPPONENT_MOVE;
  const pendingOpponentMoveOccurrenceKey =
    shouldContinuePgnMoveHighlighting &&
    !isUsersTurnByIndex &&
    isAutoPlaying &&
    !hasBranchOptionsAtCurrentPosition &&
    nextExpectedMoveSan
      ? toPgnMoveOccurrenceKey(nextMovePositionKey, nextExpectedMoveSan)
      : null;
  const highlightedOpponentMoveOccurrenceKey =
    shouldContinuePgnMoveHighlighting &&
    totalOpponentMoveHoverDurationMs > 0 &&
    recentAutoMoveOccurrenceKey
      ? recentAutoMoveOccurrenceKey
      : null;
  const highlightedPgnMoveOccurrenceKey =
    highlightedOpponentMoveOccurrenceKey ??
    (activeSpotlightMoveContext
      ? toPgnMoveOccurrenceKey(nextMovePositionKey, activeSpotlightMoveContext.san)
      : null) ??
    (shouldContinuePgnMoveHighlighting && isUsersTurnByIndex
      ? nextExpectedMoveSan
        ? toPgnMoveOccurrenceKey(nextMovePositionKey, nextExpectedMoveSan)
        : null
      : pendingOpponentMoveOccurrenceKey);

  const pgnDisplayTokens = useMemo(() => moveTextToDisplayTokens(pgn?.moveText || ""), [pgn?.moveText]);

  const pgnTextSegments = useMemo<HighlightedTextSegment[]>(() => {
    if (!isPgnMoveHighlightingEnabled || pgnDisplayTokens.length === 0) {
      return [{ key: "raw", text: pgn?.moveText || "", isHighlighted: false }];
    }

    const unmatchedBranchOccurrenceKeys = highlightedBranchOccurrenceKeys
      ? new Set(highlightedBranchOccurrenceKeys)
      : null;

    return pgnDisplayTokens.map((token) => {
      let isHighlightMatch = false;

      if (
        token.occurrenceKey &&
        unmatchedBranchOccurrenceKeys &&
        unmatchedBranchOccurrenceKeys.has(token.occurrenceKey)
      ) {
        isHighlightMatch = true;
        unmatchedBranchOccurrenceKeys.delete(token.occurrenceKey);
      } else if (token.occurrenceKey && !unmatchedBranchOccurrenceKeys && highlightedPgnMoveOccurrenceKey) {
        isHighlightMatch = token.occurrenceKey === highlightedPgnMoveOccurrenceKey;
      }

      return {
        key: token.key,
        text: token.text,
        isHighlighted: isHighlightMatch,
      };
    });
  }, [
    highlightedBranchOccurrenceKeys,
    highlightedPgnMoveOccurrenceKey,
    isPgnMoveHighlightingEnabled,
    pgn?.moveText,
    pgnDisplayTokens,
  ]);

  const highlightedPgnMoveSan = useMemo(() => {
    if (!highlightedPgnMoveOccurrenceKey) {
      return null;
    }

    const occurrenceSan = highlightedPgnMoveOccurrenceKey.split("|").slice(-1)[0];
    if (!occurrenceSan) {
      return null;
    }

    return occurrenceSan;
  }, [highlightedPgnMoveOccurrenceKey]);

  const isTutorialInteractionLocked =
    isTutorialMoveGuideActive ||
    showTutorialLineAdvancePrompt ||
    isPracticePopupVisible ||
    isBranchPopupVisible;
  const isTutorialDualFocusVisible =
    isTutorial &&
    tutorialTourComplete &&
    isTutorialMoveGuideActive &&
    activeSpotlightMoveContext !== null &&
    !isBranchPopupVisible;

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

  const handlePlayAgain = useCallback(() => {
    hasResetPersistedOnCompleteRef.current = false;
    if (!isTutorial && pgn._id && pgn._id !== "tutorial") {
      void (async () => {
        const didPersist = await updatePgnContentRef.current(pgn._id, {
          gameProgress: {
            visitedNodeHashes: [],
          },
        });
        if (didPersist) {
          persistedVisitedNodeHashesKeyRef.current = "";
        }
      })();
    }
    restartSession();
  }, [isTutorial, pgn._id, restartSession]);

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
    const spotlightSquares = new Map<string, { isDestination: boolean }>();
    for (const moveContext of activeSpotlightMoveContexts) {
      spotlightSquares.set(moveContext.sourceSquare, { isDestination: false });
      if (shouldHighlightDestinationSquareInTutorial) {
        spotlightSquares.set(moveContext.targetSquare, { isDestination: true });
      }
    }

    const holes = Array.from(spotlightSquares.entries()).flatMap(([sourceSquare, metadata]) => {
      const squareTopLeft = getSquareTopLeft(sourceSquare, isPlayingWhite, squareSize);
      if (!squareTopLeft) {
        return [];
      }

      const holeSize = squareSize;
      const destinationDegradation = Math.max(
        0,
        Math.min(1, DESTINATION_SQUARE_SPOTLIGHT_BRIGHTNESS_DEGRADATION_FACTOR)
      );
      const destinationMaskChannel = Math.round(destinationDegradation * 255);
      const destinationMaskHex = destinationMaskChannel.toString(16).padStart(2, "0");
      const maskFill = metadata.isDestination ? `#${destinationMaskHex}${destinationMaskHex}${destinationMaskHex}` : "#000";

      return [
        {
          x: squareTopLeft.x,
          y: squareTopLeft.y,
          size: holeSize,
          maskFill,
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

  const tutorialSpotlightViewportHoles = useMemo<Array<ViewportRect & { maskFill: string }>>(() => {
    if (!isTutorialDualFocusVisible || !tutorialSpotlightLayout) {
      return [];
    }

    const boardElement = boardRef.current;
    if (!boardElement || tutorialSpotlightLayout.holes.length === 0) {
      return [];
    }

    const boardRect = boardElement.getBoundingClientRect();
    return tutorialSpotlightLayout.holes.map((hole) => ({
      left: boardRect.left + hole.x,
      top: boardRect.top + hole.y,
      width: hole.size,
      height: hole.size,
      maskFill: hole.maskFill,
    }));
  }, [isTutorialDualFocusVisible, tutorialSpotlightLayout]);

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

  useEffect(() => {
    if (!isTutorialDualFocusVisible) {
      setHighlightedPgnTokenRect(null);
      return;
    }

    const pgnElement = tutorialPgnRef.current;
    if (!pgnElement) {
      setHighlightedPgnTokenRect(null);
      return;
    }

    const updateTokenRect = () => {
      const tokenElement = pgnElement.querySelector<HTMLElement>(".tutorial-pgn-token-highlight");
      if (!tokenElement) {
        setHighlightedPgnTokenRect(null);
        return;
      }

      tokenElement.scrollIntoView({ block: "nearest", inline: "nearest" });
      const rect = tokenElement.getBoundingClientRect();
      setHighlightedPgnTokenRect({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      });
    };

    updateTokenRect();
    const animationFrameId = window.requestAnimationFrame(updateTokenRect);
    window.addEventListener("resize", updateTokenRect);
    pgnElement.addEventListener("scroll", updateTokenRect);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", updateTokenRect);
      pgnElement.removeEventListener("scroll", updateTokenRect);
    };
  }, [isTutorialDualFocusVisible, pgn?.moveText, highlightedPgnMoveSan]);

  return (
    <>
      <div className={cn(
        "flex w-full min-h-screen items-center justify-center gap-6 px-6 pb-8 pt-24"
      )}>
        {/* Board */}
        <div
          ref={boardRef}
          className="relative rounded-lg border border-border/70 bg-card/40 p-2 shadow-[0_24px_48px_-24px_rgba(2,6,23,0.9)]"
          style={{ width: "min(80vh, 70vw)", height: "min(80vh, 70vw)" }}
        >
          <Board
            currFen={currFen} 
            onPieceDrop={handlePieceDrop}
            isWhite={isPlayingWhite}
            moveAnimationDuration={LENGTH_OF_OPPONENT_MOVE}
          />
          <LessonCompleteCelebration
            isCompleted={isCompleted}
            showAnimation={showCelebrationAnimation}
            onPlayAgain={handlePlayAgain}
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
                        fill={hole.maskFill}
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
          {isTutorialDualFocusVisible &&
            tutorialSpotlightViewportHoles.length > 0 &&
            highlightedPgnTokenRect &&
            typeof window !== "undefined" && (
              <div className="tutorial-dual-focus-layer" aria-hidden="true">
                <svg
                  className="tutorial-dual-focus-svg"
                  viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`}
                  preserveAspectRatio="none"
                >
                  <defs>
                    <mask id={`${spotlightMaskId}-dual-focus`}>
                      <rect x={0} y={0} width={window.innerWidth} height={window.innerHeight} fill="#fff" />
                      {tutorialSpotlightViewportHoles.map((hole, index) => (
                        <rect
                          key={`dual-focus-hole-${index}`}
                          x={hole.left}
                          y={hole.top}
                          width={hole.width}
                          height={hole.height}
                          rx={10}
                          fill={hole.maskFill}
                        />
                      ))}
                      <rect
                        x={Math.max(0, highlightedPgnTokenRect.left - 6)}
                        y={Math.max(0, highlightedPgnTokenRect.top - 4)}
                        width={highlightedPgnTokenRect.width + 12}
                        height={highlightedPgnTokenRect.height + 8}
                        rx={8}
                        fill="#000"
                      />
                    </mask>
                  </defs>
                  <rect
                    className="tutorial-dual-focus-mask"
                    x={0}
                    y={0}
                    width={window.innerWidth}
                    height={window.innerHeight}
                    mask={`url(#${spotlightMaskId}-dual-focus)`}
                  />
                </svg>
              </div>
            )}
        </div>

        {/* Aside */}
        <div className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border border-border/70 bg-card/45 p-3 backdrop-blur-sm",
          debug && "border border-red-500"
        )} style={{ width: 'min(30vw, 400px)', height: 'min(80vh, 70vw)' }}>
          
          {/* Title Notes Pgn */}
          <div className={cn(
            "flex h-full w-full flex-grow flex-col items-center gap-3 p-2",
            debug && "border border-blue-500"
          )}>
            <div className="flex w-full flex-row items-center justify-start gap-4">
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
              className="h-fit w-full rounded-md border border-border bg-card/60 p-2 text-sm text-foreground shadow-sm"
              placeholder="Notes"
            />
            {isPgnMoveHighlightingEnabled ? (
              <div
                ref={tutorialPgnRef}
                className="tutorial-pgn-display h-full w-full flex-grow rounded-md border border-border bg-card/60 p-2 text-foreground shadow-sm"
                role="textbox"
                aria-readonly="true"
                aria-label="PGN"
              >
                {pgnTextSegments.map((segment) => (
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
                className="h-full w-full flex-grow rounded-md border border-border bg-card/60 p-2 text-foreground shadow-sm"
                placeholder="PGN"
                readOnly={false}
              />
            )}
          </div>
          
          {/* Game Settings */}
          <div ref={colorRef} className="flex flex-row items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
            Play as:
            <button 
              className={`h-[25px] w-[25px] rounded-md bg-[var(--board-light)] ${isPlayingWhite ? 'border-2 border-[var(--brand-highlight)] shadow-[0_0_0_1px_var(--highlight-ring)]' : 'border border-border/70'} box-border`} 
              disabled={isTutorialInteractionLocked}
              onClick={() => setIsPlayingWhite(true)}
            ></button>
            <button 
              className={`h-[25px] w-[25px] rounded-md bg-[var(--board-dark)] ${!isPlayingWhite ? 'border-2 border-[var(--brand-highlight)] shadow-[0_0_0_1px_var(--highlight-ring)]' : 'border border-border/70'} box-border`} 
              disabled={isTutorialInteractionLocked}
              onClick={() => setIsPlayingWhite(false)}
            ></button>
          </div>
          <div ref={skipRef} className="flex flex-row items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
            Skip to first branch:
            <button 
              disabled={isTutorialInteractionLocked}
              onClick={() => setIsSkipping(!isSkipping)}
            >
              <FontAwesomeIcon 
                className="text-[var(--brand-highlight)]"
                icon={isSkipping ? faToggleOn : faToggleOff} 
                size="lg"
              />
            </button>
          </div>
          {!isTutorial && (
            <div className="flex flex-row items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
              Highlight moves:
              <button onClick={() => setIsMoveHighlightingEnabled((enabled) => !enabled)}>
                <FontAwesomeIcon
                  className="text-[var(--brand-highlight)]"
                  icon={isMoveHighlightingEnabled ? faToggleOn : faToggleOff}
                  size="lg"
                />
              </button>
            </div>
          )}

          {/* Hint Button */}
          <button 
            ref={hintRef}
            className="w-full rounded-md border border-border bg-card/60 p-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent/70"
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
                ? "border-[var(--highlight-ring)] bg-[var(--token-highlight-bg)] text-foreground"
                : "border-border bg-card/60 text-foreground"
            )}
          >
            {isCompleted
              ? "Lesson complete: all lines covered."
              : showTutorialLineAdvancePrompt
                ? "Line finished: continue when ready."
                : "Lesson in progress"}
          </div>

          {moveRejectionMessage && (
            <div className="w-full rounded border border-amber-300/60 bg-amber-500/20 px-3 py-2 text-center text-sm font-medium text-amber-100">
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
