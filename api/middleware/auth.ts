import { verifyToken } from "../utils/jwt";
import { IUserDocument, User } from "../models/User";
import logger from "../utils/logger";
import { Request, Response, NextFunction } from 'express';
import { StoredUser } from "../types/auth";

export const auth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    req.user = undefined;
    return next();
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    req.user = undefined;
    return next();
  }

  const user: IUserDocument | null = await User.findById(decoded.userId);
  if (!user) {
    req.user = undefined;
    return next();
  }

  logger.debug(`[Auth]: User ${user.username} authenticated`);
  const serializedUser: StoredUser = {
    _id: user._id.toString(),
    username: user.username,
    email: user.email,
    passwordHash: user.passwordHash,
    createdAt: user.createdAt.toISOString(),
  };
  req.user = serializedUser;
  return next();
};
