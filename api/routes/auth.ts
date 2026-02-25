import { IUserDocument, User } from "../models/User";
import { hash, verify } from "@node-rs/argon2";
import { Router, Request, Response, RequestHandler } from "express";
import { generateToken, verifyToken } from "../utils/jwt";
import logger from "../utils/logger";
import { randomUUID } from "crypto";

const router = Router();

/* Notes
- I typecast async functionas as RequestHandlers both to specify the req object in sign-up and to be able to return non-null values. I want to return for ts type checking, so I don't have to check for null values (ex. user?.username -> user.username)
*/

interface SignUpBody {
  email: string;
  username: string;
  password: string;
}

interface GoogleSignInBody {
  idToken: string;
}

type GoogleTokenInfo = {
  aud: string;
  sub: string;
  email: string;
  email_verified: string | boolean;
  name?: string;
  given_name?: string;
};

const hashOptions = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

const buildUsernameFromGoogle = (tokenInfo: GoogleTokenInfo): string => {
  const raw =
    tokenInfo.given_name ||
    tokenInfo.name ||
    tokenInfo.email?.split("@")[0] ||
    "player";
  const normalized = raw.replace(/[^a-zA-Z0-9_-]/g, "").trim();
  return normalized.slice(0, 24) || "player";
};

const verifyGoogleIdToken = async (
  idToken: string
): Promise<GoogleTokenInfo | null> => {
  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(
        idToken
      )}`
    );
    if (!response.ok) {
      return null;
    }

    const tokenInfo = (await response.json()) as GoogleTokenInfo;
    const expectedAudience = process.env.GOOGLE_CLIENT_ID;
    if (expectedAudience && tokenInfo.aud !== expectedAudience) {
      return null;
    }

    const emailVerified =
      tokenInfo.email_verified === true || tokenInfo.email_verified === "true";
    if (!emailVerified || !tokenInfo.email) {
      return null;
    }
    return tokenInfo;
  } catch (error) {
    logger.error("[Google Sign In] Token validation failed:", error);
    return null;
  }
};

router.post("/sign-up", (async (req: Request<{}, {}, SignUpBody>, res: Response) => {
  try {
    const { email, username, password } = req.body;
    const passwordHash = await hash(password, hashOptions);
    logger.debug(`[Sign Up] Attempting to create user with email: ${email}`);
    logger.debug("[Sign Up] Password hashed successfully");

    // Make sure user doesn't already exist
    const existingUser: IUserDocument | null = await User.findOne({ email });
    if (existingUser) {
      logger.warn(`[Sign Up] User already exists with email: ${email}`);
      res.json({ message: "User already exists" });
    }

    // Create serialized user
    const user: IUserDocument = await User.create({
      email,
      username,
      passwordHash,
    });
    logger.info(`[Sign Up] User created successfully: ${user._id}`);

    // Generate JWT token
    const token: string = generateToken(user._id.toString());
    logger.debug("[Sign Up] JWT token generated");

    return res.json({
      success: true,
      message: "User signed up successfully",
      user,
      token,
    });
  } catch (error) {
    logger.error("[Sign Up] Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}) as RequestHandler);

router.post(
  "/sign-in-google",
  (async (req: Request<{}, {}, GoogleSignInBody>, res: Response) => {
    try {
      const { idToken } = req.body;
      if (!idToken) {
        res.status(400).json({
          success: false,
          message: "Google ID token is required",
        });
        return;
      }

      const tokenInfo = await verifyGoogleIdToken(idToken);
      if (!tokenInfo) {
        res.status(401).json({
          success: false,
          message: "Google authentication failed",
        });
        return;
      }

      let user = await User.findOne({ email: tokenInfo.email });
      if (!user) {
        const passwordHash = await hash(`oauth-${randomUUID()}`, hashOptions);
        user = await User.create({
          email: tokenInfo.email,
          username: buildUsernameFromGoogle(tokenInfo),
          passwordHash,
        });
      }

      const token = generateToken(user._id.toString());
      res.json({
        success: true,
        message: "User signed in with Google successfully",
        user,
        token,
      });
      return;
    } catch (error) {
      logger.error("[Google Sign In] Error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
      return;
    }
  }) as RequestHandler
);

router.post("/sign-in", (async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    logger.debug(`[Sign In] Attempting to sign in with email: ${email}`);

    const user: IUserDocument | null = await User.findOne({ email });
    if (!user) {
      logger.warn(`[Sign In] User not found with email: ${email}`);
      return res.status(401).json({
        success: false,
        message: "Incorrect email or password",
      });
    }
    if (!user.username || !user.passwordHash) {
      return res.status(401).json({
        success: false,
        message: "Error retrieving user information",
      });
    }
    logger.debug(`[Sign In] User found w/ username: ${user.username}`);

    logger.debug("[Sign In] Starting password verification...");
    logger.debug(
      `[Sign In] Stored hash: ${user.passwordHash.substring(0, 10)}...`
    );
    logger.debug(`[Sign In] Provided password: ${password.substring(0, 1)}...`);

    const validPassword = await verify(
      user.passwordHash,
      password,
      hashOptions
    );
    logger.debug(`[Sign In] Password verification result: ${validPassword}`);

    if (!validPassword) {
      logger.warn(`[Sign In] Invalid password for user: ${email}`);
      return res.status(401).json({
        success: false,
        message: "Incorrect email or password",
      });
    }
    logger.debug("[Sign In] Password verified successfully");

    // Generate JWT token
    const token = generateToken(user._id.toString());
    logger.debug("[Sign In] JWT token generated");

    logger.info(`[Sign In] User ${user._id} signed in successfully`);
    res.json({
      success: true,
      message: "User signed in successfully",
      user,
      token,
    });
  } catch (error) {
    logger.error("[Sign In] Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}) as RequestHandler);

router.post("/sign-out", async (req: Request, res: Response) => {
  // With JWT, we don't need to do anything on the server side
  // The client should remove the token
  logger.info("[Sign Out] User signed out");
  res.json({
    success: true,
    message: "Signed out successfully",
  });
});

router.get("/validate-token", async (req: Request, res: Response) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  logger.debug(
    `[Validate Token] Received token: ${token ? "Present" : "Missing"}`
  );

  if (!token) {
    logger.warn("[Validate Token] No token provided");
    res.status(401).json({
      success: false,
      message: "No token provided",
    });
  }

  const decoded = verifyToken(token as string);
  if (!decoded) {
    logger.warn("[Validate Token] Invalid token");
    res.status(401).json({
      success: false,
      message: "Invalid token",
    });
    return;
  }
  logger.debug(
    `[Validate Token] Token decoded successfully: ${JSON.stringify(decoded)}`
  );

  const user = await User.findById(decoded.userId);
  if (!user) {
    logger.warn("[Validate Token] User not found for decoded token");
    res.status(401).json({
      success: false,
      message: "User not found",
    });
    return;
  }
  logger.debug(`[Validate Token] User found: ${user.username}`);

  res.json({
    success: true,
    message: "Token is valid",
    user,
  });
});

router.get("/users", async (req: Request, res: Response) => {
  try {
    const users = await User.find();
    logger.debug(`[Users] Retrieved ${users.length} users`);
    res.status(200).json({ users, success: true });
  } catch (error) {
    logger.error("[Users] Error fetching users:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;
