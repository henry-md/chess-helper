import { useEffect } from "react";
import { useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import ChessApp from "../components/ChessApp";
import { useStore } from "@nanostores/react";
import { $pgnDict, setPgn } from "../store/pgn";
import { API_URL } from "@/env";
import { getAuthHeader, handleUnauthorizedResponse } from "@/utils/auth";
import { setCurrentPgnId } from "../store/gameCore";
import { setCurrentLine, setCurrentLineIdx } from "../store/gameCore";
import { StoredPgn } from "@/lib/types";
import { setGameOver } from "../store/gameCore";
import { setIsPlayingWhiteStore, setIsSkippingStore } from "@/store/chessSettings";

const Game = () => {
  const { id } = useParams();
  const pgnDict = useStore($pgnDict);
  const currentPgnObject = pgnDict && id ? pgnDict[id] : undefined;
  
  // Update game state
  if (!currentPgnObject) return <div>Loading...</div>;

  // Load game & game state from id
  useEffect(() => {
    const abortController = new AbortController();

    const fetchPgn = async () => {
      if (!id) return;
      setCurrentPgnId(id);

      try {
        const response = await fetch(`${API_URL}/pgn/${id}`, {
          method: "GET",
          headers: getAuthHeader(),
          signal: abortController.signal,
        });
        if (!response.ok) {
          if (handleUnauthorizedResponse(response.status)) {
            return;
          }
          return;
        }

        const data = await response.json();
        const pgn: StoredPgn = data.pgn;
        setPgn(pgn);
        setIsSkippingStore(pgn.gameSettings.isSkipping);
        setIsPlayingWhiteStore(pgn.gameSettings.isPlayingWhite);
        setCurrentLine([]);
        setCurrentLineIdx(0);
        setGameOver(false);
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }
        console.error("Failed to load PGN", error);
      }
    };

    fetchPgn();

    return () => {
      abortController.abort();
    };
  }, [id]);

  if (!currentPgnObject) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Navbar />
      <ChessApp />
    </>
  );
};

export default Game;
