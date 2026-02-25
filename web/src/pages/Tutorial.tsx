import { useEffect } from "react";
import { TUTORIAL_NOTES, TUTORIAL_PGN } from "@/constants";
import { $pgn, setPgn } from "@/store/pgn";
import { StoredPgn } from "@/lib/types";
import Navbar from "../components/Navbar";
import ChessApp from "../components/ChessApp";

const Tutorial = () => {
  useEffect(() => {
    const existingPgn = $pgn.get();
    const tutorialPgn: StoredPgn = {
      _id: existingPgn?._id ?? "tutorial",
      userId: existingPgn?.userId ?? "tutorial",
      title: "Interactive PGN Tutorial",
      moveText: TUTORIAL_PGN,
      notes: TUTORIAL_NOTES,
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
  }, []);

  return (
    <>
      <Navbar />
      <ChessApp isTutorial />
    </>
  );
};

export default Tutorial;
