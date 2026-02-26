import { API_URL } from "@/env";
import { toast } from "react-toastify";
import { addPgnDict, updatePgnDict, deletePgnFromDict, $pgn, $pgnDict, setPgn } from "@/store/pgn";
import { getAuthHeader, handleUnauthorizedResponse } from "@/utils/auth";
import logger from "@/utils/logger";
import { formatError } from "@/utils/error";
import { StoredPgn } from "@/lib/types";

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

      if (handleUnauthorizedResponse(response.status)) {
        return undefined;
      }
      
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
  ): Promise<boolean> => {
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
      if (handleUnauthorizedResponse(response.status)) {
        return false;
      }
      const res = await response.json();
      if (!response.ok) {
        toast.error(formatError(res));
        return false;
      }

      const pgn: StoredPgn = res.pgn;
      updatePgnDict(pgn);
      if ($pgn.get()?._id === pgn._id) {
        setPgn(pgn);
      }
      // triggerPgnsRefresh();
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Error updating PGN");
      return false;
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

      if (handleUnauthorizedResponse(response.status)) {
        return;
      }
      
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
