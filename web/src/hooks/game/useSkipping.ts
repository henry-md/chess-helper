import { API_URL } from "@/env";
import { StoredPgn } from "@/lib/types";
import { $isSkipping, setIsSkippingStore } from "@/store/chessSettings";
import { getAuthHeader, handleUnauthorizedResponse } from "@/utils/auth";
import { useStore } from "@nanostores/react";
import { toast } from "react-toastify";

type UseSkippingOptions = {
  persistRemotely?: boolean;
};

const useSkipping = (pgn: StoredPgn, options: UseSkippingOptions = {}) => {
  const isSkipping = useStore($isSkipping);
  const persistRemotely = options.persistRemotely ?? true;

  const shouldSkipRemoteUpdate =
    !persistRemotely || pgn._id === "tutorial" || pgn.userId === "tutorial";

  const setIsSkipping = async (value: boolean) => {
    const previousValue = isSkipping;
    setIsSkippingStore(value);

    if (shouldSkipRemoteUpdate) {
      return;
    }

    try {
      const body = {
        gameSettings: {
          isSkipping: value,
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
        setIsSkippingStore(previousValue);
        if (handleUnauthorizedResponse(response.status)) {
          return;
        }
        toast.error("Error updating PGN");
      }
    } catch {
      setIsSkippingStore(previousValue);
      toast.error("Error updating PGN");
    }
  };

  return { isSkipping, setIsSkipping };
};

export default useSkipping;
