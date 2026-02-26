import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import {
  BUFFFER_TIME_BETWEEN_USER_AND_OPPONENT_MOVE,
  BUFFER_TIME_BEFORE_NEXT_LINE,
  LENGTH_OF_OPPONENT_MOVE,
} from "@/constants";
import {
  findNumMovesToFirstBranch,
  hashMoveNode,
  mainlinesToMoveTree,
  moveTextToMainlines,
  toPgnMoveOccurrenceKey,
} from "@/utils/chess/pgn-parser";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AUTO_MOVE_DELAY_MS = BUFFFER_TIME_BETWEEN_USER_AND_OPPONENT_MOVE;
const HINT_DURATION_MS = 500;
const OPPONENT_MOVE_HOVER_DURATION_MS =
  BUFFFER_TIME_BETWEEN_USER_AND_OPPONENT_MOVE + LENGTH_OF_OPPONENT_MOVE;

type PositionMoveLeafIndex = Map<string, Map<string, string[]>>;

type LeafPlan = {
  leafHash: string;
  sanPath: string[];
  nodeHashPath: string[];
};

type TreeIndex = {
  leafPlansByHash: Map<string, LeafPlan>;
  leafHashesInOrder: string[];
  positionMoveLeafIndex: PositionMoveLeafIndex;
  occurrenceNodeHashByKey: Map<string, string>;
};

type UseLineQuizSessionArgs = {
  moveText: string;
  isPlayingWhite: boolean;
  isSkipping: boolean;
  initialVisitedNodeHashes?: string[];
  isPaused?: boolean;
  randomizeOpponentBranchMoves?: boolean;
  manualLineAdvance?: boolean;
  onSessionComplete?: () => void;
};

type UseLineQuizSessionResult = {
  currFen: string;
  isAutoPlaying: boolean;
  isCompleted: boolean;
  visitedNodeHashes: string[];
  isTransitioningBetweenLines: boolean;
  isAwaitingLineAdvance: boolean;
  remainingLineCount: number;
  currentMoveIndex: number;
  nextExpectedMoveSan: string | null;
  nextMovePositionKey: string;
  recentAutoMoveOccurrenceKey: string | null;
  moveRejectionMessage: string | null;
  onPieceDrop: (sourceSquare: string, targetSquare: string) => boolean;
  continueToNextLine: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  showHint: () => void;
  restartSession: () => void;
};

const removeTimeoutId = (timeoutIds: number[], targetId: number): number[] => {
  return timeoutIds.filter((timeoutId) => timeoutId !== targetId);
};

const getPositionKey = (nextMoveIndex: number, playedMoves: string[]): string => {
  return `${nextMoveIndex}|${playedMoves.join(" ")}`;
};

const chooseLeafHash = (
  candidateLeafHashes: string[] | undefined,
  visitedLeafHashes: Set<string>
): string | null => {
  if (!candidateLeafHashes || candidateLeafHashes.length === 0) {
    return null;
  }

  const firstUnvisited = candidateLeafHashes.find((leafHash) => !visitedLeafHashes.has(leafHash));
  return firstUnvisited ?? candidateLeafHashes[0] ?? null;
};

const normalizeVisitedNodeHashes = (nodeHashes: string[] | undefined): string[] => {
  if (!nodeHashes || nodeHashes.length === 0) {
    return [];
  }

  return Array.from(new Set(nodeHashes.filter((nodeHash) => typeof nodeHash === "string" && nodeHash.length > 0)));
};

const buildTreeIndex = (lineMovesByIndex: string[][]): TreeIndex => {
  const mainlines = lineMovesByIndex.map((moves) => moves.join(" "));
  const root = mainlinesToMoveTree(mainlines);

  const leafPlansByHash = new Map<string, LeafPlan>();
  const leafHashesInOrder: string[] = [];
  const positionMoveLeafIndex: PositionMoveLeafIndex = new Map();
  const occurrenceNodeHashByKey = new Map<string, string>();

  const walk = (node: typeof root, sanPath: string[], nodeHashPath: string[]) => {
    if (node.children.length === 0) {
      if (nodeHashPath.length === 0) {
        return;
      }

      const leafHash = nodeHashPath[nodeHashPath.length - 1] ?? "";
      if (!leafHash || leafPlansByHash.has(leafHash)) {
        return;
      }

      const plan: LeafPlan = {
        leafHash,
        sanPath: [...sanPath],
        nodeHashPath: [...nodeHashPath],
      };

      leafPlansByHash.set(leafHash, plan);
      leafHashesInOrder.push(leafHash);

      for (let moveIndex = 0; moveIndex < sanPath.length; moveIndex++) {
        const positionKey = `${moveIndex}|${sanPath.slice(0, moveIndex).join(" ")}`;
        const moveSan = sanPath[moveIndex] ?? "";
        const nodeHash = nodeHashPath[moveIndex] ?? "";
        if (!moveSan || !nodeHash) {
          continue;
        }

        let moveToLeafHashes = positionMoveLeafIndex.get(positionKey);
        if (!moveToLeafHashes) {
          moveToLeafHashes = new Map<string, string[]>();
          positionMoveLeafIndex.set(positionKey, moveToLeafHashes);
        }

        let leafHashesForMove = moveToLeafHashes.get(moveSan);
        if (!leafHashesForMove) {
          leafHashesForMove = [];
          moveToLeafHashes.set(moveSan, leafHashesForMove);
        }

        if (!leafHashesForMove.includes(leafHash)) {
          leafHashesForMove.push(leafHash);
        }

        const occurrenceKey = toPgnMoveOccurrenceKey(positionKey, moveSan);
        if (!occurrenceNodeHashByKey.has(occurrenceKey)) {
          occurrenceNodeHashByKey.set(occurrenceKey, nodeHash);
        }
      }
      return;
    }

    for (const child of node.children) {
      const childHash = hashMoveNode(child);
      walk(child, [...sanPath, child.move], [...nodeHashPath, childHash]);
    }
  };

  walk(root, [], []);

  return {
    leafPlansByHash,
    leafHashesInOrder,
    positionMoveLeafIndex,
    occurrenceNodeHashByKey,
  };
};

const useLineQuizSession = ({
  moveText,
  isPlayingWhite,
  isSkipping,
  initialVisitedNodeHashes = [],
  isPaused = false,
  randomizeOpponentBranchMoves = false,
  manualLineAdvance = false,
  onSessionComplete,
}: UseLineQuizSessionArgs): UseLineQuizSessionResult => {
  const mainlines = useMemo(() => moveTextToMainlines(moveText), [moveText]);
  const lineMovesByIndex = useMemo(
    () => mainlines.map((line) => line.split(/\s+/).filter(Boolean)),
    [mainlines]
  );
  const treeIndex = useMemo(() => buildTreeIndex(lineMovesByIndex), [lineMovesByIndex]);
  const skipPlies = useMemo(() => findNumMovesToFirstBranch(moveText), [moveText]);
  const normalizedInitialVisitedNodeHashes = useMemo(
    () => normalizeVisitedNodeHashes(initialVisitedNodeHashes),
    [initialVisitedNodeHashes]
  );

  const [currFen, setCurrFen] = useState(START_FEN);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [visitedNodeHashes, setVisitedNodeHashes] = useState<string[]>(
    normalizedInitialVisitedNodeHashes
  );
  const [isTransitioningBetweenLines, setIsTransitioningBetweenLines] = useState(false);
  const [isAwaitingLineAdvance, setIsAwaitingLineAdvance] = useState(false);
  const [remainingLineCount, setRemainingLineCount] = useState(treeIndex.leafHashesInOrder.length);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [nextExpectedMoveSan, setNextExpectedMoveSan] = useState<string | null>(null);
  const [nextMovePositionKey, setNextMovePositionKey] = useState("0|");
  const [recentAutoMoveOccurrenceKey, setRecentAutoMoveOccurrenceKey] = useState<string | null>(
    null
  );
  const [moveRejectionMessage, setMoveRejectionMessage] = useState<string | null>(null);

  const isAutoPlayingRef = useRef(false);
  const isCompletedRef = useRef(false);
  const isAwaitingLineAdvanceRef = useRef(false);
  const isPausedRef = useRef(isPaused);
  const randomizeOpponentBranchMovesRef = useRef(randomizeOpponentBranchMoves);

  const chessRef = useRef(new Chess());
  const currentTargetLeafHashRef = useRef<string | null>(null);
  const currentMoveIdxRef = useRef(-1);
  const furthestMoveIdxRef = useRef(-1);
  const playedSanHistoryRef = useRef<string[]>([]);
  const scheduledTimeoutIdsRef = useRef<number[]>([]);
  const autoMoveHighlightTimeoutIdRef = useRef<number | null>(null);
  const visitedLeafHashesRef = useRef<Set<string>>(new Set());
  const visitedNodeHashesRef = useRef<Set<string>>(new Set());
  const branchCycleChoicesRef = useRef<Map<string, Set<string>>>(new Map());
  const pendingNextLeafHashRef = useRef<string | null>(null);

  const isPlayingWhiteRef = useRef(isPlayingWhite);
  const isSkippingRef = useRef(isSkipping);
  const manualLineAdvanceRef = useRef(manualLineAdvance);
  const skipPliesRef = useRef(skipPlies);
  const treeIndexRef = useRef(treeIndex);
  const onSessionCompleteRef = useRef(onSessionComplete);
  const initialVisitedNodeHashesRef = useRef(normalizedInitialVisitedNodeHashes);

  useEffect(() => {
    isPlayingWhiteRef.current = isPlayingWhite;
  }, [isPlayingWhite]);

  useEffect(() => {
    isSkippingRef.current = isSkipping;
  }, [isSkipping]);

  useEffect(() => {
    manualLineAdvanceRef.current = manualLineAdvance;
  }, [manualLineAdvance]);

  useEffect(() => {
    skipPliesRef.current = skipPlies;
  }, [skipPlies]);

  useEffect(() => {
    treeIndexRef.current = treeIndex;
  }, [treeIndex]);

  useEffect(() => {
    onSessionCompleteRef.current = onSessionComplete;
  }, [onSessionComplete]);

  useEffect(() => {
    initialVisitedNodeHashesRef.current = normalizedInitialVisitedNodeHashes;
  }, [normalizedInitialVisitedNodeHashes]);

  useEffect(() => {
    isAutoPlayingRef.current = isAutoPlaying;
  }, [isAutoPlaying]);

  useEffect(() => {
    isCompletedRef.current = isCompleted;
  }, [isCompleted]);

  useEffect(() => {
    isAwaitingLineAdvanceRef.current = isAwaitingLineAdvance;
  }, [isAwaitingLineAdvance]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    randomizeOpponentBranchMovesRef.current = randomizeOpponentBranchMoves;
  }, [randomizeOpponentBranchMoves]);

  const clearScheduledTimeouts = useCallback(() => {
    for (const timeoutId of scheduledTimeoutIdsRef.current) {
      window.clearTimeout(timeoutId);
    }
    scheduledTimeoutIdsRef.current = [];
  }, []);

  const clearAutoMoveHighlight = useCallback(() => {
    if (autoMoveHighlightTimeoutIdRef.current !== null) {
      window.clearTimeout(autoMoveHighlightTimeoutIdRef.current);
      autoMoveHighlightTimeoutIdRef.current = null;
    }
    setRecentAutoMoveOccurrenceKey(null);
  }, []);

  const flashAutoMoveOccurrence = useCallback(
    (positionKey: string, moveSan: string) => {
      clearAutoMoveHighlight();
      setRecentAutoMoveOccurrenceKey(toPgnMoveOccurrenceKey(positionKey, moveSan));
      autoMoveHighlightTimeoutIdRef.current = window.setTimeout(() => {
        autoMoveHighlightTimeoutIdRef.current = null;
        setRecentAutoMoveOccurrenceKey(null);
      }, OPPONENT_MOVE_HOVER_DURATION_MS - BUFFFER_TIME_BETWEEN_USER_AND_OPPONENT_MOVE);
    },
    [clearAutoMoveHighlight]
  );

  const clearScheduledActions = useCallback(() => {
    clearScheduledTimeouts();
    clearAutoMoveHighlight();
    setIsTransitioningBetweenLines(false);
    setIsAwaitingLineAdvance(false);
    pendingNextLeafHashRef.current = null;
    setIsAutoPlaying(false);
  }, [clearAutoMoveHighlight, clearScheduledTimeouts]);

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

  const getCurrentTargetPlan = useCallback((): LeafPlan | null => {
    const targetLeafHash = currentTargetLeafHashRef.current;
    if (!targetLeafHash) {
      return null;
    }

    return treeIndexRef.current.leafPlansByHash.get(targetLeafHash) ?? null;
  }, []);

  const isCurrentLineComplete = useCallback((): boolean => {
    const targetPlan = getCurrentTargetPlan();
    if (!targetPlan) {
      return false;
    }

    return (
      currentMoveIdxRef.current >= 0 &&
      currentMoveIdxRef.current >= targetPlan.sanPath.length - 1
    );
  }, [getCurrentTargetPlan]);

  const syncNextMoveState = useCallback((currentMoveIndexInLine: number) => {
    const targetPlan = getCurrentTargetPlan();
    const nextMoveIndexInLine = currentMoveIndexInLine + 1;
    const playedMoves = chessRef.current.history();

    setNextExpectedMoveSan(targetPlan?.sanPath[nextMoveIndexInLine] ?? null);
    setNextMovePositionKey(getPositionKey(nextMoveIndexInLine, playedMoves));
  }, [getCurrentTargetPlan]);

  const getNextIncompleteLeafHash = useCallback((): string | null => {
    const visitedLeafHashes = visitedLeafHashesRef.current;
    for (const leafHash of treeIndexRef.current.leafHashesInOrder) {
      if (!visitedLeafHashes.has(leafHash)) {
        return leafHash;
      }
    }
    return null;
  }, []);

  const markVisitedNodeHash = useCallback((nodeHash: string | undefined): void => {
    if (!nodeHash) {
      return;
    }

    if (visitedNodeHashesRef.current.has(nodeHash)) {
      return;
    }

    visitedNodeHashesRef.current.add(nodeHash);
    setVisitedNodeHashes((prevNodeHashes) => {
      if (prevNodeHashes.includes(nodeHash)) {
        return prevNodeHashes;
      }
      return [...prevNodeHashes, nodeHash];
    });
  }, []);

  const playExpectedNextMove = useCallback((): boolean => {
    const playedMovesBefore = chessRef.current.history();
    const nextMoveIndexInLine = currentMoveIdxRef.current + 1;
    const targetPlan = getCurrentTargetPlan();
    const fallbackMove = targetPlan?.sanPath[nextMoveIndexInLine];
    if (!fallbackMove) {
      return false;
    }

    const positionKey = getPositionKey(nextMoveIndexInLine, playedMovesBefore);
    const moveToLeafHashes = treeIndexRef.current.positionMoveLeafIndex.get(positionKey);
    const isComputerTurn = !isUsersTurn();

    let selectedMove = fallbackMove;
    let selectedLeafHash = currentTargetLeafHashRef.current;

    if (
      randomizeOpponentBranchMovesRef.current &&
      isComputerTurn &&
      moveToLeafHashes &&
      moveToLeafHashes.size > 1
    ) {
      const moveOptions = Array.from(moveToLeafHashes.entries());
      const moveOptionsWithIncompleteLeaves = moveOptions.filter(([, leafHashes]) =>
        leafHashes.some((leafHash) => !visitedLeafHashesRef.current.has(leafHash))
      );
      const selectionPool =
        moveOptionsWithIncompleteLeaves.length > 0 ? moveOptionsWithIncompleteLeaves : moveOptions;
      const randomChoice = selectionPool[Math.floor(Math.random() * selectionPool.length)];
      if (randomChoice) {
        const [randomMoveSan, candidateLeafHashes] = randomChoice;
        selectedMove = randomMoveSan;
        selectedLeafHash = chooseLeafHash(candidateLeafHashes, visitedLeafHashesRef.current);
      }
    }

    const moveResult = chessRef.current.move(selectedMove);
    if (!moveResult) {
      return false;
    }

    if (selectedLeafHash) {
      currentTargetLeafHashRef.current = selectedLeafHash;
    }

    const occurrenceKey = toPgnMoveOccurrenceKey(positionKey, selectedMove);
    const nodeHash = treeIndexRef.current.occurrenceNodeHashByKey.get(occurrenceKey);
    markVisitedNodeHash(nodeHash);

    flashAutoMoveOccurrence(positionKey, selectedMove);

    playedSanHistoryRef.current[nextMoveIndexInLine] = selectedMove;
    playedSanHistoryRef.current = playedSanHistoryRef.current.slice(0, nextMoveIndexInLine + 1);

    currentMoveIdxRef.current = nextMoveIndexInLine;
    setCurrentMoveIndex(nextMoveIndexInLine);
    syncNextMoveState(nextMoveIndexInLine);
    furthestMoveIdxRef.current = Math.max(furthestMoveIdxRef.current, nextMoveIndexInLine);
    setCurrFen(chessRef.current.fen());

    return true;
  }, [flashAutoMoveOccurrence, getCurrentTargetPlan, isUsersTurn, markVisitedNodeHash, syncNextMoveState]);

  const startLeafRef = useRef<(leafHash: string) => void>(() => {});
  const runAutoMovesRef = useRef<(pliesRemaining: number, delayMs: number) => void>(() => {});

  const advanceToNextLineOrComplete = useCallback(() => {
    const completedLeafHash = currentTargetLeafHashRef.current;
    if (completedLeafHash) {
      visitedLeafHashesRef.current.add(completedLeafHash);
    }

    const nextLeafHash = getNextIncompleteLeafHash();
    if (nextLeafHash) {
      const remaining = treeIndexRef.current.leafHashesInOrder.length - visitedLeafHashesRef.current.size;
      setRemainingLineCount(Math.max(remaining, 0));

      if (manualLineAdvanceRef.current) {
        pendingNextLeafHashRef.current = nextLeafHash;
        setIsTransitioningBetweenLines(true);
        setIsAwaitingLineAdvance(true);
        setIsAutoPlaying(false);
        return;
      }

      setIsTransitioningBetweenLines(true);
      setIsAutoPlaying(true);
      scheduleAction(() => {
        startLeafRef.current(nextLeafHash);
      }, BUFFER_TIME_BEFORE_NEXT_LINE);
      return;
    }

    setIsTransitioningBetweenLines(false);
    setIsAwaitingLineAdvance(false);
    pendingNextLeafHashRef.current = null;
    setRemainingLineCount(0);
    setIsAutoPlaying(false);
    setIsCompleted(true);
    onSessionCompleteRef.current?.();
  }, [getNextIncompleteLeafHash, scheduleAction]);

  const runAutoMoves = useCallback(
    (pliesRemaining: number, delayMs: number = AUTO_MOVE_DELAY_MS): void => {
      if (isPausedRef.current) {
        setIsAutoPlaying(false);
        return;
      }

      if (pliesRemaining <= 0) {
        setIsAutoPlaying(false);
        return;
      }

      setIsAutoPlaying(true);
      scheduleAction(() => {
        if (isPausedRef.current) {
          setIsAutoPlaying(false);
          return;
        }

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

  const startLeaf = useCallback(
    (leafHash: string): void => {
      clearScheduledActions();

      const targetPlan = treeIndexRef.current.leafPlansByHash.get(leafHash);
      if (!targetPlan) {
        return;
      }

      currentTargetLeafHashRef.current = leafHash;
      currentMoveIdxRef.current = -1;
      setCurrentMoveIndex(-1);
      furthestMoveIdxRef.current = -1;
      playedSanHistoryRef.current = [];
      setIsCompleted(false);
      setIsTransitioningBetweenLines(false);
      setMoveRejectionMessage(null);

      chessRef.current.reset();
      setCurrFen(chessRef.current.fen());
      syncNextMoveState(-1);

      if (targetPlan.sanPath.length === 0) {
        advanceToNextLineOrComplete();
        return;
      }

      let autoPlies = 0;
      if (isSkippingRef.current) {
        autoPlies = Math.min(skipPliesRef.current, targetPlan.sanPath.length);
      }

      const nextMoveIndexAfterSkip = autoPlies;
      if (nextMoveIndexAfterSkip < targetPlan.sanPath.length) {
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
    [advanceToNextLineOrComplete, clearScheduledActions, syncNextMoveState]
  );
  startLeafRef.current = startLeaf;

  const continueToNextLine = useCallback(() => {
    const nextLeafHash = pendingNextLeafHashRef.current;
    if (!nextLeafHash) {
      return;
    }

    pendingNextLeafHashRef.current = null;
    setIsAwaitingLineAdvance(false);
    startLeafRef.current(nextLeafHash);
  }, []);

  const restartSession = useCallback(() => {
    clearScheduledActions();
    const leafHashesInOrder = treeIndexRef.current.leafHashesInOrder;

    if (leafHashesInOrder.length === 0) {
      chessRef.current.reset();
      currentTargetLeafHashRef.current = null;
      playedSanHistoryRef.current = [];
      visitedLeafHashesRef.current = new Set();
      visitedNodeHashesRef.current = new Set();
      setVisitedNodeHashes([]);
      branchCycleChoicesRef.current = new Map();
      pendingNextLeafHashRef.current = null;
      currentMoveIdxRef.current = -1;
      furthestMoveIdxRef.current = -1;
      setCurrentMoveIndex(-1);
      setNextExpectedMoveSan(null);
      setNextMovePositionKey("0|");
      setIsCompleted(false);
      setIsTransitioningBetweenLines(false);
      setIsAwaitingLineAdvance(false);
      setRemainingLineCount(0);
      setMoveRejectionMessage(null);
      setCurrFen(chessRef.current.fen());
      return;
    }

    visitedLeafHashesRef.current = new Set();
    visitedNodeHashesRef.current = new Set();
    setVisitedNodeHashes([]);
    branchCycleChoicesRef.current = new Map();
    pendingNextLeafHashRef.current = null;
    setIsCompleted(false);
    setIsTransitioningBetweenLines(false);
    setIsAwaitingLineAdvance(false);
    setMoveRejectionMessage(null);
    setRemainingLineCount(leafHashesInOrder.length);

    const firstLeafHash = leafHashesInOrder[0];
    if (!firstLeafHash) {
      chessRef.current.reset();
      currentTargetLeafHashRef.current = null;
      playedSanHistoryRef.current = [];
      currentMoveIdxRef.current = -1;
      furthestMoveIdxRef.current = -1;
      setCurrentMoveIndex(-1);
      setNextExpectedMoveSan(null);
      setNextMovePositionKey("0|");
      setCurrFen(chessRef.current.fen());
      return;
    }

    startLeafRef.current(firstLeafHash);
  }, [clearScheduledActions]);

  const onPieceDrop = useCallback(
    (sourceSquare: string, targetSquare: string): boolean => {
      if (isCompletedRef.current) {
        return false;
      }

      if (isAutoPlayingRef.current) {
        return false;
      }

      if (isPausedRef.current) {
        return false;
      }

      if (isAwaitingLineAdvanceRef.current) {
        return false;
      }

      if (isCurrentLineComplete()) {
        return false;
      }

      if (!isUsersTurn()) {
        return false;
      }

      const playedMovesBefore = chessRef.current.history();
      const nextMoveIndexInLine = currentMoveIdxRef.current + 1;
      const targetPlan = getCurrentTargetPlan();
      const expectedMove = targetPlan?.sanPath[nextMoveIndexInLine];
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

      const positionKey = getPositionKey(nextMoveIndexInLine, playedMovesBefore);
      const moveToLeafHashes = treeIndexRef.current.positionMoveLeafIndex.get(positionKey);
      const leafHashesForMove = moveToLeafHashes?.get(moveAttempt.san) ?? [];

      const isKnownPgnMoveAtPosition = leafHashesForMove.length > 0;
      if (!isKnownPgnMoveAtPosition && moveAttempt.san !== expectedMove) {
        chessRef.current.undo();
        setCurrFen(chessRef.current.fen());
        return false;
      }

      if (moveToLeafHashes && moveToLeafHashes.size > 1) {
        const branchCycleChoices = branchCycleChoicesRef.current;
        const alreadyChosenAtPosition = branchCycleChoices.get(positionKey) ?? new Set<string>();

        if (alreadyChosenAtPosition.has(moveAttempt.san)) {
          chessRef.current.undo();
          setCurrFen(chessRef.current.fen());
          setMoveRejectionMessage("That move was already chosen at this branch. Pick a different PGN move.");
          return false;
        }

        alreadyChosenAtPosition.add(moveAttempt.san);

        if (alreadyChosenAtPosition.size >= moveToLeafHashes.size) {
          branchCycleChoices.delete(positionKey);
        } else {
          branchCycleChoices.set(positionKey, alreadyChosenAtPosition);
        }
      }

      const selectedLeafHash = chooseLeafHash(leafHashesForMove, visitedLeafHashesRef.current);
      if (selectedLeafHash) {
        currentTargetLeafHashRef.current = selectedLeafHash;
      }

      const occurrenceKey = toPgnMoveOccurrenceKey(positionKey, moveAttempt.san);
      const nodeHash = treeIndexRef.current.occurrenceNodeHashByKey.get(occurrenceKey);
      markVisitedNodeHash(nodeHash);

      playedSanHistoryRef.current[nextMoveIndexInLine] = moveAttempt.san;
      playedSanHistoryRef.current = playedSanHistoryRef.current.slice(0, nextMoveIndexInLine + 1);

      currentMoveIdxRef.current = nextMoveIndexInLine;
      setCurrentMoveIndex(nextMoveIndexInLine);
      syncNextMoveState(nextMoveIndexInLine);
      setRecentAutoMoveOccurrenceKey(null);
      furthestMoveIdxRef.current = Math.max(furthestMoveIdxRef.current, nextMoveIndexInLine);
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
    [
      advanceToNextLineOrComplete,
      getCurrentTargetPlan,
      isCurrentLineComplete,
      isUsersTurn,
      markVisitedNodeHash,
      syncNextMoveState,
    ]
  );

  const stepForward = useCallback(() => {
    if (isCompletedRef.current) {
      return;
    }

    if (isAutoPlayingRef.current) {
      return;
    }

    if (isPausedRef.current) {
      return;
    }

    if (isAwaitingLineAdvanceRef.current) {
      return;
    }

    if (currentMoveIdxRef.current >= furthestMoveIdxRef.current) {
      return;
    }

    const nextMoveIndexInLine = currentMoveIdxRef.current + 1;
    const nextMove = playedSanHistoryRef.current[nextMoveIndexInLine];
    if (!nextMove) {
      return;
    }

    const moveResult = chessRef.current.move(nextMove);
    if (!moveResult) {
      return;
    }

    currentMoveIdxRef.current = nextMoveIndexInLine;
    setCurrentMoveIndex(nextMoveIndexInLine);
    syncNextMoveState(nextMoveIndexInLine);
    setRecentAutoMoveOccurrenceKey(null);
    setCurrFen(chessRef.current.fen());
  }, [syncNextMoveState]);

  const stepBackward = useCallback(() => {
    if (isCompletedRef.current) {
      return;
    }

    if (isAutoPlayingRef.current) {
      return;
    }

    if (isPausedRef.current) {
      return;
    }

    if (isAwaitingLineAdvanceRef.current) {
      return;
    }

    if (currentMoveIdxRef.current < 0) {
      return;
    }

    chessRef.current.undo();
    currentMoveIdxRef.current -= 1;
    setCurrentMoveIndex(currentMoveIdxRef.current);
    syncNextMoveState(currentMoveIdxRef.current);
    setRecentAutoMoveOccurrenceKey(null);
    setCurrFen(chessRef.current.fen());
  }, [syncNextMoveState]);

  const showHint = useCallback(() => {
    if (isCompletedRef.current) {
      return;
    }

    if (isAutoPlayingRef.current) {
      return;
    }

    if (isPausedRef.current) {
      return;
    }

    if (isAwaitingLineAdvanceRef.current) {
      return;
    }

    if (!isUsersTurn()) {
      return;
    }

    const nextMoveIndexInLine = currentMoveIdxRef.current + 1;
    const targetPlan = getCurrentTargetPlan();
    const nextMove = targetPlan?.sanPath[nextMoveIndexInLine];
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
  }, [getCurrentTargetPlan, isUsersTurn, scheduleAction]);

  useEffect(() => {
    if (isPaused) {
      clearScheduledTimeouts();
      setIsAutoPlaying(false);
      return;
    }

    if (!currentTargetLeafHashRef.current) {
      return;
    }

    if (isCompletedRef.current || isAwaitingLineAdvanceRef.current || isAutoPlayingRef.current) {
      return;
    }

    if (!isCurrentLineComplete() && !isUsersTurn()) {
      runAutoMovesRef.current(1, AUTO_MOVE_DELAY_MS);
    }
  }, [clearScheduledTimeouts, isCurrentLineComplete, isPaused, isUsersTurn]);

  useEffect(() => {
    return () => {
      clearAutoMoveHighlight();
    };
  }, [clearAutoMoveHighlight]);

  useEffect(() => {
    if (treeIndex.leafHashesInOrder.length === 0) {
      clearScheduledActions();
      chessRef.current.reset();
      currentTargetLeafHashRef.current = null;
      playedSanHistoryRef.current = [];
      visitedLeafHashesRef.current = new Set();
      visitedNodeHashesRef.current = new Set();
      setVisitedNodeHashes([]);
      branchCycleChoicesRef.current = new Map();
      pendingNextLeafHashRef.current = null;
      currentMoveIdxRef.current = -1;
      furthestMoveIdxRef.current = -1;
      setCurrentMoveIndex(-1);
      setNextExpectedMoveSan(null);
      setNextMovePositionKey("0|");
      setIsCompleted(false);
      setIsTransitioningBetweenLines(false);
      setIsAwaitingLineAdvance(false);
      setRemainingLineCount(0);
      setMoveRejectionMessage(null);
      setCurrFen(chessRef.current.fen());
      return undefined;
    }

    const initialVisitedNodeSet = new Set(initialVisitedNodeHashesRef.current);
    visitedNodeHashesRef.current = initialVisitedNodeSet;
    setVisitedNodeHashes(Array.from(initialVisitedNodeSet));
    visitedLeafHashesRef.current = new Set(
      treeIndex.leafHashesInOrder.filter((leafHash) => initialVisitedNodeSet.has(leafHash))
    );
    branchCycleChoicesRef.current = new Map();
    pendingNextLeafHashRef.current = null;
    setIsAwaitingLineAdvance(false);
    setRemainingLineCount(
      Math.max(treeIndex.leafHashesInOrder.length - visitedLeafHashesRef.current.size, 0)
    );

    const firstLeafHash = getNextIncompleteLeafHash();
    if (!firstLeafHash) {
      setIsCompleted(true);
      setIsTransitioningBetweenLines(false);
      setIsAwaitingLineAdvance(false);
      setRemainingLineCount(0);
      setNextExpectedMoveSan(null);
      setNextMovePositionKey("0|");
      return clearScheduledActions;
    }

    startLeafRef.current(firstLeafHash);
    return clearScheduledActions;
  }, [
    clearScheduledActions,
    getNextIncompleteLeafHash,
    isPlayingWhite,
    isSkipping,
    skipPlies,
    treeIndex,
  ]);

  return {
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
    stepForward,
    stepBackward,
    showHint,
    restartSession,
  };
};

export default useLineQuizSession;
