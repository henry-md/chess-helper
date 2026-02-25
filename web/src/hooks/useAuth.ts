import { useStore } from "@nanostores/react";
import { $user, clearUser, setUser } from "@/store/auth";
import { API_URL } from "@/env";
import logger from "@/utils/logger";
import { setIsAuthenticated } from "@/store/auth";
import { getAuthHeader } from "@/utils/auth";
import { IUser, IUserDocument, StoredUser } from "@/lib/types";
import { serializeUser } from "@/lib/serializers";

function useAuth() {
  const user = useStore($user);

  const register = async (email: string, username: string, password: string) => {
    try {
      if (!email || !username || !password) {
        throw new Error("Email, username, and password are required!");
      }
      logger.debug("[Register] Attempting to register user:", { email, username });
      
      const response = await fetch(`${API_URL}/sign-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password }),
      });
      
      logger.debug("[Register] Register response status:", response.status);
      if (!response.ok) {
        throw new Error(`API request failed! with status: ${response.status}`);
      }

      const { user, token } = await response.json();
      logger.debug("[Register] Registration successful, setting token and user");
      localStorage.setItem('token', token);
      setUser(user);
      setIsAuthenticated(true);
      return { success: true };
    } catch (error) {
      logger.error("[Register] Registration error:", error);
      const errorMessage =
        (error as Error).message ?? "Please try again later!";
      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const login = async (email: string, password: string) => {
    try {
      if (!email || !password) {
        throw new Error("Email and password are required!");
      }
      logger.debug("[Login] Attempting to login user:", { email, password });
      
      const response = await fetch(`${API_URL}/sign-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      
      logger.debug("[Login] Login response status:", response.status);
      if (!response.ok) {
        const errorData = await response.json();
        logger.error("[Login] Login failed:", errorData);
        throw new Error(errorData.message || `API request failed! with status: ${response.status}`);
      }

      const { user, token } = await response.json();
      logger.debug("[Login] Login successful, setting token and user");
      localStorage.setItem('token', token);
      setUser(user);
      setIsAuthenticated(true);
      return { success: true };
    } catch (error) {
      logger.error("[Login] Login error:", error);
      const errorMessage =
        (error as Error).message ?? "Please try again later!";
      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const loginWithGoogle = async (idToken: string) => {
    try {
      if (!idToken) {
        throw new Error("Google ID token is required!");
      }

      const response = await fetch(`${API_URL}/sign-in-google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `API request failed! with status: ${response.status}`
        );
      }

      const { user, token } = await response.json();
      localStorage.setItem("token", token);
      setUser(user);
      setIsAuthenticated(true);
      return { success: true };
    } catch (error) {
      logger.error("[Google Login] Login error:", error);
      const errorMessage =
        (error as Error).message ?? "Please try again later!";
      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const logout = async () => {
    try {
      logger.debug("[Logout] Attempting to logout");
      await fetch(`${API_URL}/sign-out`, {
        method: "POST",
        headers: getAuthHeader(),
      });
      localStorage.removeItem('token');
      clearUser();
      setIsAuthenticated(false);
      logger.debug("[Logout] Logout successful");
    } catch (error) {
      logger.error("[Logout] Logout error:", error);
      setIsAuthenticated(false);
    }
  };

  const validate = async () => {
    if (!user || !user.email) {
      logger.debug("[Validate] No user found, validation failed");
      setIsAuthenticated(false);
      return false;
    }

    try {
      logger.debug("[Validate] Validating token");
      const response = await fetch(`${API_URL}/validate-token`, {
        headers: getAuthHeader(),
      });
      
      logger.debug("[Validate] Validation response status:", response.status);
      if (!response.ok) {
        logger.debug("[Validate] Token validation failed");
        localStorage.removeItem('token');
        clearUser();
        setIsAuthenticated(false);
        return false;
      }
      
      const data = await response.json();
      const user: StoredUser = data.user;
      logger.debug("[Validate] Token validated successfully");
      setUser(user);
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      logger.error("[Validate] Validation error:", error);
      localStorage.removeItem('token');
      clearUser();
      setIsAuthenticated(false);
      return false;
    }
  };

  return { user, login, loginWithGoogle, register, logout, validate };
}

export default useAuth;
