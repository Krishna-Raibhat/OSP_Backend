import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../utils/env";
import { HttpError } from "../utils/errors";

export interface JwtPayload {
  userId: string;
  email: string;
  role: "admin" | "user" | "distributor";
}

export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  // Check for missing token BEFORE try/catch
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new HttpError(401, "Unauthorized. No token provided."));
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    // attach user to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    return next();
  } catch (err) {
    // Only JWT verification errors reach here
    return next(new HttpError(401, "Invalid or expired token."));
  }
}

// Optional auth middleware - doesn't fail if no token
export function optionalAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  // If no token, just continue without user
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    // attach user to request if token is valid
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    return next();
  } catch (err) {
    // If token is invalid, just continue without user (guest checkout)
    return next();
  }
}
