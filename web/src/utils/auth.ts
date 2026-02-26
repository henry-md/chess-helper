import logger from "@/utils/logger";
import { clearUser, setIsAuthenticated } from "@/store/auth";
import { clearPgn, clearPgnDict } from "@/store/pgn";

export const getAuthHeader = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  logger.debug("[Auth] Getting auth header:", token ? "Token present" : "No token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const clearClientSession = (): void => {
  localStorage.removeItem("token");
  clearUser();
  clearPgn();
  clearPgnDict();
  setIsAuthenticated(false);
};

export const handleUnauthorizedResponse = (status: number): boolean => {
  if (status !== 401) {
    return false;
  }

  clearClientSession();
  return true;
};
