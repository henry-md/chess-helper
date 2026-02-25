import { useMemo } from "react";
import { MoveNode, StoredPgn } from "@/lib/types";
import { mainlinesToMoveTree, moveTextToMainlines } from "@/utils/chess/pgn-parser";

const useGame = (pgn: StoredPgn) => {
  const rootNode = useMemo<MoveNode>(() => {
    return mainlinesToMoveTree(moveTextToMainlines(pgn.moveText));
  }, [pgn.moveText]);

  return {
    fen: rootNode.fen,
    rootNode,
  };
};

export default useGame;
