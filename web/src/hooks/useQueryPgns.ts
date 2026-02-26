import { useEffect, useState } from "react";
import { useStore } from "@nanostores/react";
import {
  setPgnDict,
  $pgnDict,
} from "@/store/pgn";
import { API_URL } from "@/env";
import { toast } from "react-toastify";
import { getAuthHeader } from "@/utils/auth";
import { handleUnauthorizedResponse } from "@/utils/auth";
import logger from "@/utils/logger";
import { StoredPgn } from "@/lib/types";
import { $isAuthenticated } from "@/store/auth";

function useQueryPgns() {
  const pgnDict = useStore($pgnDict);
  const isAuthenticated = useStore($isAuthenticated);
  const [isLoading, setIsLoading] = useState(true);

  const loadPgns = async () => {
    if (!isAuthenticated) {
      setPgnDict([]);
      setIsLoading(false);
      return;
    }

    try {
      // Get search params and do stuff (later)
      // const searchParams = new URLSearchParams(window.location.search);

      const response = await fetch(`${API_URL}/pgns`, {
        method: "GET",
        headers: getAuthHeader(),
      });
      if (!response.ok) {
        if (handleUnauthorizedResponse(response.status)) {
          setPgnDict([]);
          return;
        }
        throw new Error(`API request failed with status: ${response.status}`);
      }
      const data = await response.json();
      const pgnsArray: StoredPgn[] = data.pgns ?? [];
      logger.debug('[useQueryPgns] Fetched PGNs:', pgnsArray);
      setPgnDict(pgnsArray);
      logger.error('now pgnDict', pgnDict);
    } catch (error) {
      const errorMessage =
        (error as Error).message ?? "Please try again later!";
      toast.error(`Error reading PGNs: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    logger.debug('[useQueryPgns] Starting load, setting loading state');
    setIsLoading(true);
    loadPgns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [window.location.search, isAuthenticated]); // refreshTrigger

  // Convert back to array for components that need it
  const pgnArray = Object.values(pgnDict);
  return { pgnArray, isLoading };
}

export default useQueryPgns;
