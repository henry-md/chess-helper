import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { BUFFER_TIME_BEFORE_NEXT_LINE } from "@/constants";
import { findNumMovesToFirstBranch, moveTextToMainlines } from "@/utils/chess/pgn-parser";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AUTO_MOVE_DELAY_MS = 220;
const HINT_DURATION_MS = 500;

type PositionMoveLineIndex = Map<string, Map<string, number[]>>;

type UseLineQuizSessionArgs = {
  moveText: string;
  isPlayingWhite: boolean;
  isSkipping: boolean;
  onSessionComplete?: () => void;
};

type UseLineQuizSessionResult = {
  currFen: string;
  isAutoPlaying: boolean;
  isCompleted: boolean;
  isTransitioningBetweenLines: boolean;
  moveRejectionMessage: string | null;
  onPieceDrop: (sourceSquare: string, targetSquare: string) => boolean;
  stepForward: () => void;
  stepBackward: () => void;
  showHint: () => void;
};

const removeTimeoutId = (timeoutIds: number[], targetId: number): number[] => {
  return timeoutIds.filter((timeoutId) => timeoutId !== targetId);
};

const getPositionKey = (nextMoveIndex: number, playedMoves: string[]): string => {
  return `${nextMoveIndex}|${playedMoves.join(" ")}`;
};

const buildPositionMoveLineIndex = (lineMovesByIndex: string[][]): PositionMoveLineIndex => {
  const positionMoveLineIndex: PositionMoveLineIndex = new Map();

  for (const [lineIdx, lineMoves] of lineMovesByIndex.entries()) {
    for (let moveIdx = 0; moveIdx < lineMoves.length; moveIdx++) {
      const positionKey = getPositionKey(moveIdx, lineMoves.slice(0, moveIdx));
      const move = lineMoves[moveIdx];

      if (!positionMoveLineIndex.has(positionKey)) {
        positionMoveLineIndex.set(positionKey, new Map());
      }

      const moveToLineIndices = positionMoveLineIndex.get(positionKey)!;
      if (!moveToLineIndices.has(move)) {
        moveToLineIndices.set(move, []);
      }

      const lineIndices = moveToLineIndices.get(move)!;
      if (!lineIndices.includes(lineIdx)) {
        lineIndices.push(lineIdx);
      }
    }
  }

  return positionMoveLineIndex;
};

const useLineQuizSession = ({
  moveText,
  isPlayingWhite,
  isSkipping,
  onSessionComplete,
}: UseLineQuizSessionArgs): UseLineQuizSessionResult => {
  const mainlines = useMemo(() => moveTextToMainlines(moveText), [moveText]);
  const lineMovesByIndex = useMemo(
    () => mainlines.map((line) => line.split(/\s+/).filter(Boolean)),
    [mainlines]
  );
  const positionMoveLineIndex = useMemo(
    () => buildPositionMoveLineIndex(lineMovesByIndex),
    [lineMovesByIndex]
  );
  const skipPlies = useMemo(() => findNumMovesToFirstBranch(moveText), [moveText]);

  const [currFen, setCurrFen] = useState(START_FEN);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isTransitioningBetweenLines, setIsTransitioningBetweenLines] = useState(false);
  const [moveRejectionMessage, setMoveRejectionMessage] = useState<string | null>(null);
  const isAutoPlayingRef = useRef(false);
  const isCompletedRef = useRef(false);

  const chessRef = useRef(new Chess());
  const movesRef = useRef<string[]>([]);
  const currentLineIdxRef = useRef(0);
  const currentMoveIdxRef = useRef(-1);
  const furthestMoveIdxRef = useRef(-1);
  const scheduledTimeoutIdsRef = useRef<number[]>([]);
  const completedLineIndicesRef = useRef<Set<number>>(new Set());
  const branchCycleChoicesRef = useRef<Map<string, Set<string>>>(new Map());

  const isPlayingWhiteRef = useRef(isPlayingWhite);
  const isSkippingRef = useRef(isSkipping);
  const skipPliesRef = useRef(skipPlies);
  const lineMovesByIndexRef = useRef(lineMovesByIndex);
  const positionMoveLineIndexRef = useRef(positionMoveLineIndex);
  const onSessionCompleteRef = useRef(onSessionComplete);

  useEffect(() => {
    isPlayingWhiteRef.current = isPlayingWhite;
  }, [isPlayingWhite]);

  useEffect(() => {
    isSkippingRef.current = isSkipping;
  }, [isSkipping]);

  useEffect(() => {
    skipPliesRef.current = skipPlies;
  }, [skipPlies]);

  useEffect(() => {
    lineMovesByIndexRef.current = lineMovesByIndex;
  }, [lineMovesByIndex]);

  useEffect(() => {
    positionMoveLineIndexRef.current = positionMoveLineIndex;
  }, [positionMoveLineIndex]);

  useEffect(() => {
    onSessionCompleteRef.current = onSessionComplete;
  }, [onSessionComplete]);

  useEffect(() => {
    isAutoPlayingRef.current = isAutoPlaying;
  }, [isAutoPlaying]);

  useEffect(() => {
    isCompletedRef.current = isCompleted;
  }, [isCompleted]);

  const clearScheduledActions = useCallback(() => {
    for (const timeoutId of scheduledTimeoutIdsRef.current) {
      window.clearTimeout(timeoutId);
    }
    scheduledTimeoutIdsRef.current = [];
    setIsTransitioningBetweenLines(false);
    setIsAutoPlaying(false);
  }, []);

  const scheduleAction = useCallback((callback: () => void, delayMs: number): void => {
    const timeoutId = window.setTimeout(() => {
      scheduledTimeoutIdsRef.current = removeTimeoutId(scheduledTimeoutIdsRef.current, timeoutId);
      callback();
    }, delayMs);
    scheduledTimeoutIdsRef.current.push(timeoutId);
  }, []);

  const isUsersTurn = useCallback((): boolean => {
    const nextMoveIndex = currentMoveIdxRef.current + 1;
    const nextMoveIsWhite = nextMoveIndex % 2 === 0;
    return nextMoveIsWhite === isPlayingWhiteRef.current;
  }, []);

  const isCurrentLineComplete = useCallback((): boolean => {
    return (
      currentMoveIdxRef.current >= 0 &&
      currentMoveIdxRef.current === movesRef.current.length - 1
    );
  }, []);

  const playExpectedNextMove = useCallback((): boolean => {
    const nextMoveIndex = currentMoveIdxRef.current + 1;
    const expectedMove = movesRef.current[nextMoveIndex];
    if (!expectedMove) {
      return false;
    }

    const moveResult = chessRef.current.move(expectedMove);
    if (!moveResult) {
      return false;
    }

    currentMoveIdxRef.current = nextMoveIndex;
    furthestMoveIdxRef.current = Math.max(furthestMoveIdxRef.current, nextMoveIndex);
    setCurrFen(chessRef.current.fen());
    return true;
  }, []);

  const startLineRef = useRef<(lineIndex: number) => void>(() => {});
  const runAutoMovesRef = useRef<(pliesRemaining: number, delayMs: number) => void>(() => {});

  const getNextIncompleteLineIndex = useCallback((): number | null => {
    const completedLineIndices = completedLineIndicesRef.current;
    const lines = lineMovesByIndexRef.current;
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (!completedLineIndices.has(lineIdx)) {
        return lineIdx;
      }
    }
    return null;
  }, []);

  const advanceToNextLineOrComplete = useCallback(() => {
    completedLineIndicesRef.current.add(currentLineIdxRef.current);

    const nextLineIdx = getNextIncompleteLineIndex();
    if (nextLineIdx !== null) {
      setIsTransitioningBetweenLines(true);
      setIsAutoPlaying(true);
      scheduleAction(() => {
        startLineRef.current(nextLineIdx);
      }, BUFFER_TIME_BEFORE_NEXT_LINE);
      return;
    }

    setIsTransitioningBetweenLines(false);
    setIsAutoPlaying(false);
    setIsCompleted(true);
    onSessionCompleteRef.current?.();
  }, [getNextIncompleteLineIndex, scheduleAction]);

  const runAutoMoves = useCallback(
    (pliesRemaining: number, delayMs: number = AUTO_MOVE_DELAY_MS): void => {
      if (pliesRemaining <= 0) {
        setIsAutoPlaying(false);
        return;
      }

      setIsAutoPlaying(true);
      scheduleAction(() => {
        const moved = playExpectedNextMove();
        if (!moved) {
          setIsAutoPlaying(false);
          return;
        }

        if (isCurrentLineComplete()) {
          setIsAutoPlaying(false);
          advanceToNextLineOrComplete();
          return;
        }

        runAutoMovesRef.current(pliesRemaining - 1, AUTO_MOVE_DELAY_MS);
      }, delayMs);
    },
    [advanceToNextLineOrComplete, isCurrentLineComplete, playExpectedNextMove, scheduleAction]
  );
  runAutoMovesRef.current = runAutoMoves;

  const startLine = useCallback(
    (lineIndex: number): void => {
      clearScheduledActions();

      const lineMoves = lineMovesByIndexRef.current[lineIndex] ?? [];
      currentLineIdxRef.current = lineIndex;
      currentMoveIdxRef.current = -1;
      furthestMoveIdxRef.current = -1;
      setIsCompleted(false);
      setIsTransitioningBetweenLines(false);
      setMoveRejectionMessage(null);

      chessRef.current.reset();
      movesRef.current = lineMoves;
      setCurrFen(chessRef.current.fen());

      if (movesRef.current.length === 0) {
        advanceToNextLineOrComplete();
        return;
      }

      let autoPlies = 0;
      if (isSkippingRef.current) {
        autoPlies = Math.min(skipPliesRef.current, movesRef.current.length);
      }

      const nextMoveIndexAfterSkip = autoPlies;
      if (nextMoveIndexAfterSkip < movesRef.current.length) {
        const nextMoveIsWhite = nextMoveIndexAfterSkip % 2 === 0;
        const usersTurnAfterSkip = nextMoveIsWhite === isPlayingWhiteRef.current;
        if (!usersTurnAfterSkip) {
          autoPlies += 1;
        }
      }

      if (autoPlies > 0) {
        runAutoMovesRef.current(autoPlies, AUTO_MOVE_DELAY_MS);
      } else {
        setIsAutoPlaying(false);
      }
    },
    [advanceToNextLineOrComplete, clearScheduledActions]
  );
  startLineRef.current = startLine;

  const onPieceDrop = useCallback(
    (sourceSquare: string, targetSquare: string): boolean => {
      if (isCompletedRef.current) {
        return false;
      }

      if (isAutoPlayingRef.current) {
        return false;
      }

      if (isCurrentLineComplete()) {
        return false;
      }

      if (!isUsersTurn()) {
        return false;
      }

      const playedMovesBefore = chessRef.current.history();
      const nextMoveIndex = currentMoveIdxRef.current + 1;
      const expectedMove = movesRef.current[nextMoveIndex];
      if (!expectedMove) {
        return false;
      }

      const moveAttempt = chessRef.current.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });

      if (!moveAttempt) {
        return false;
      }

      const positionKey = getPositionKey(nextMoveIndex, playedMovesBefore);
      const moveToLineIndices = positionMoveLineIndexRef.current.get(positionKey);
      const lineIndicesForMove = moveToLineIndices?.get(moveAttempt.san) ?? [];

      const isKnownPgnMoveAtPosition = lineIndicesForMove.length > 0;
      if (!isKnownPgnMoveAtPosition && moveAttempt.san !== expectedMove) {
        chessRef.current.undo();
        setCurrFen(chessRef.current.fen());
        return false;
      }

      if (moveToLineIndices && moveToLineIndices.size > 1) {
        const branchCycleChoices = branchCycleChoicesRef.current;
        const alreadyChosenAtPosition = branchCycleChoices.get(positionKey) ?? new Set<string>();

        if (alreadyChosenAtPosition.has(moveAttempt.san)) {
          chessRef.current.undo();
          setCurrFen(chessRef.current.fen());
          setMoveRejectionMessage("That move was already chosen at this branch. Pick a different PGN move.");
          return false;
        }

        alreadyChosenAtPosition.add(moveAttempt.san);

        // Reset the cycle after all branch moves at this position have been chosen once.
        if (alreadyChosenAtPosition.size >= moveToLineIndices.size) {
          branchCycleChoices.delete(positionKey);
        } else {
          branchCycleChoices.set(positionKey, alreadyChosenAtPosition);
        }
      }

      if (lineIndicesForMove.length > 0) {
        const incompleteLineIndices = lineIndicesForMove.filter(
          (lineIdx) => !completedLineIndicesRef.current.has(lineIdx)
        );
        const nextLineIdx = incompleteLineIndices[0] ?? lineIndicesForMove[0];
        currentLineIdxRef.current = nextLineIdx;
        movesRef.current = lineMovesByIndexRef.current[nextLineIdx] ?? [];
      }

      currentMoveIdxRef.current = nextMoveIndex;
      furthestMoveIdxRef.current = Math.max(furthestMoveIdxRef.current, nextMoveIndex);
      setCurrFen(chessRef.current.fen());
      setMoveRejectionMessage(null);

      if (isCurrentLineComplete()) {
        advanceToNextLineOrComplete();
        return true;
      }

      if (!isUsersTurn()) {
        runAutoMovesRef.current(1, AUTO_MOVE_DELAY_MS);
      }

      return true;
    },
    [advanceToNextLineOrComplete, isCurrentLineComplete, isUsersTurn]
  );

  const stepForward = useCallback(() => {
    if (isCompletedRef.current) {
      return;
    }

    if (isAutoPlayingRef.current) {
      return;
    }

    if (currentMoveIdxRef.current >= furthestMoveIdxRef.current) {
      return;
    }

    const nextMoveIndex = currentMoveIdxRef.current + 1;
    const nextMove = movesRef.current[nextMoveIndex];
    if (!nextMove) {
      return;
    }

    const moveResult = chessRef.current.move(nextMove);
    if (!moveResult) {
      return;
    }

    currentMoveIdxRef.current = nextMoveIndex;
    setCurrFen(chessRef.current.fen());
  }, []);

  const stepBackward = useCallback(() => {
    if (isCompletedRef.current) {
      return;
    }

    if (isAutoPlayingRef.current) {
      return;
    }

    if (currentMoveIdxRef.current < 0) {
      return;
    }

    chessRef.current.undo();
    currentMoveIdxRef.current -= 1;
    setCurrFen(chessRef.current.fen());
  }, []);

  const showHint = useCallback(() => {
    if (isCompletedRef.current) {
      return;
    }

    if (isAutoPlayingRef.current) {
      return;
    }

    if (!isUsersTurn()) {
      return;
    }

    const nextMoveIndex = currentMoveIdxRef.current + 1;
    const nextMove = movesRef.current[nextMoveIndex];
    if (!nextMove) {
      return;
    }

    const previewChess = new Chess(chessRef.current.fen());
    const previewMove = previewChess.move(nextMove);
    if (!previewMove) {
      return;
    }

    setIsAutoPlaying(true);
    setCurrFen(previewChess.fen());
    scheduleAction(() => {
      setCurrFen(chessRef.current.fen());
      setIsAutoPlaying(false);
    }, HINT_DURATION_MS);
  }, [isUsersTurn, scheduleAction]);

  useEffect(() => {
    if (mainlines.length === 0) {
      clearScheduledActions();
      chessRef.current.reset();
      movesRef.current = [];
      completedLineIndicesRef.current = new Set();
      branchCycleChoicesRef.current = new Map();
      currentLineIdxRef.current = 0;
      currentMoveIdxRef.current = -1;
      furthestMoveIdxRef.current = -1;
      setIsCompleted(false);
      setIsTransitioningBetweenLines(false);
      setMoveRejectionMessage(null);
      setCurrFen(chessRef.current.fen());
      return undefined;
    }

    completedLineIndicesRef.current = new Set();
    branchCycleChoicesRef.current = new Map();

    const firstLineIdx = getNextIncompleteLineIndex();
    if (firstLineIdx === null) {
      setIsCompleted(true);
      setIsTransitioningBetweenLines(false);
      return clearScheduledActions;
    }

    startLineRef.current(firstLineIdx);
    return clearScheduledActions;
  }, [
    clearScheduledActions,
    getNextIncompleteLineIndex,
    isPlayingWhite,
    isSkipping,
    mainlines,
    skipPlies,
  ]);

  return {
    currFen,
    isAutoPlaying,
    isCompleted,
    isTransitioningBetweenLines,
    moveRejectionMessage,
    onPieceDrop,
    stepForward,
    stepBackward,
    showHint,
  };
};

export default useLineQuizSession;
