import { StoredPgn } from "@/lib/types";
import { $isPlayingWhite, setIsPlayingWhiteStore } from "@/store/chessSettings";
import { getAuthHeader, handleUnauthorizedResponse } from "@/utils/auth";
import { useStore } from "@nanostores/react";
import { toast } from "react-toastify";
import { API_URL } from "@/env";

type UsePlayingColorOptions = {
  persistRemotely?: boolean;
};

const usePlayingColor = (pgn: StoredPgn, options: UsePlayingColorOptions = {}) => {
  const isPlayingWhite = useStore($isPlayingWhite);
  const persistRemotely = options.persistRemotely ?? true;

  const shouldSkipRemoteUpdate =
    !persistRemotely || pgn._id === "tutorial" || pgn.userId === "tutorial";

  const setIsPlayingWhite = async (value: boolean) => {
    const previousValue = isPlayingWhite;
    setIsPlayingWhiteStore(value);

    if (shouldSkipRemoteUpdate) {
      return;
    }

    try {
      const body = {
        gameSettings: {
          isPlayingWhite: value,
        },
      };
      const response = await fetch(`${API_URL}/pgn/${pgn._id}`, {
        method: "PATCH",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setIsPlayingWhiteStore(previousValue);
        if (handleUnauthorizedResponse(response.status)) {
          return;
        }
        toast.error("Error updating PGN");
      }
    } catch {
      setIsPlayingWhiteStore(previousValue);
      toast.error("Error updating PGN");
    }
  };

  return { isPlayingWhite, setIsPlayingWhite };
};

export default usePlayingColor;
