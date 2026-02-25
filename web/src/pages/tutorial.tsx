import { useEffect } from "react";
import { TUTORIAL_PGN } from "@/constants";
import { findNumMovesToFirstBranch, moveTextToMainlines } from "@/utils/chess/pgn-parser";
import { setMainlines, setNumMovesToFirstBranch } from "@/store/game-core";
import { $pgn, setPgn } from "@/store/pgn";
import { StoredPgn } from "@/lib/types";
import Navbar from "../components/navbar";
import ChessApp from "../utils/old/old-chess-app";

const Tutorial = () => {
  useEffect(() => {
    const existingPgn = $pgn.get();
    const tutorialPgn: StoredPgn = {
      _id: existingPgn?._id ?? "tutorial",
      userId: existingPgn?.userId ?? "tutorial",
      title: "Tutorial",
      moveText: TUTORIAL_PGN,
      notes: existingPgn?.notes ?? "",
      isPublic: existingPgn?.isPublic ?? false,
      gameProgress: existingPgn?.gameProgress ?? { visitedNodeHashes: [] },
      gameSettings: existingPgn?.gameSettings ?? {
        isPlayingWhite: true,
        isSkipping: false,
      },
      gameMetadata: existingPgn?.gameMetadata ?? {
        fenBeforeFirstBranch: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      },
      createdAt: existingPgn?.createdAt ?? new Date(0).toISOString(),
    };

    setPgn(tutorialPgn);
    setMainlines(moveTextToMainlines(TUTORIAL_PGN));
    setNumMovesToFirstBranch(findNumMovesToFirstBranch(TUTORIAL_PGN));
  }, []);

  return (
    <>
      <Navbar />
      <ChessApp isTutorial />
    </>
  );
};

export default Tutorial;
