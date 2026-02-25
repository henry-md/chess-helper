import { API_URL } from "@/env";
import { toast } from "react-toastify";
import { addPgnDict, updatePgnDict, deletePgnFromDict, $pgnDict } from "@/store/pgn";
import { getAuthHeader } from "@/utils/auth";
import logger from "@/utils/logger";
import { formatError } from "@/utils/error";
import { IPgn, StoredPgn } from "@/lib/types";

type PgnUpdate = {
  title?: string;
  moveText?: string;
  notes?: string;
  isPublic?: boolean;
  gameSettings?: {
    isPlayingWhite?: boolean;
    isSkipping?: boolean;
  };
  gameMetadata?: {
    fenBeforeFirstBranch?: string;
  };
  gameProgress?: {
    visitedNodeHashes?: string[];
  };
};

function useMutationPgns() {
  const createPgn = async ({
    title,
    moveText,
    notes = "",
    isPublic = false 
  }: {
    title: string;
    moveText: string;
    notes?: string;
    isPublic?: boolean;
  }) => {
    try {
      console.log('trying to create pgn');
      const response = await fetch(`${API_URL}/pgn`, {
        method: "POST",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ title, moveText, notes, isPublic }),
      });
      
      logger.debug(`[useMutationPgns] Creating PGN "${title}" with move text "${moveText}" and notes "${notes}" and isPublic "${isPublic}"; response: ${JSON.stringify(response)}`);
      const data = await response.json();
      
      if (!response.ok) {
        toast.error(formatError(data));
        return undefined;
      } else {
        addPgnDict(data.pgn);
        // triggerPgnsRefresh();
        return data.pgn;
      }
    } catch (error) {
      console.error('reached error');
      toast.error("Error adding PGN");
      return undefined;
    }
  }

  const updatePgnContent = async (
    pgnId: string,
    updates: PgnUpdate
  ) => {
    logger.debug(`[useMutationPgns] Updating PGN ${pgnId} with ${JSON.stringify(updates)}`);
    try {
      const response = await fetch(`${API_URL}/pgn/${pgnId}`, {
        method: "PATCH",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(updates),
      });
      const res = await response.json();
      console.log('res', res);
      const pgn: StoredPgn = res.pgn;
      updatePgnDict(pgn);
      // triggerPgnsRefresh();
    } catch (error) {
      console.error(error);
      toast.error("Error updating PGN");
    }
  }

  const deletePgn = async (pgnId: string) => {
    // Get current state before deletion for potential rollback
    const currentState = $pgnDict.get();
    
    try {
      // Optimistically remove from local state
      deletePgnFromDict(pgnId);

      // Make the API call
      const response = await fetch(`${API_URL}/pgn/${pgnId}`, { 
        method: "DELETE", 
        headers: getAuthHeader(),
      });
      
      // Rollback state on server error
      if (!response.ok) {
        $pgnDict.set(currentState);
        toast.error(`Error deleting PGN: ${response.statusText}`);
      }
    } catch (error) {
      // Rollback state on network error
      $pgnDict.set(currentState);
      toast.error(`Error deleting PGN: ${error}`);
    }
  }

  return { createPgn, updatePgnContent, deletePgn };
}

export default useMutationPgns;