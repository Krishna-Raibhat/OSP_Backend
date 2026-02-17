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
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new HttpError(401, "Unauthorized. No token provided.");
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    // attach user to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (err) {
    next(new HttpError(401, "Invalid or expired token."));
  }
}

// Optional auth middleware - doesn't fail if no token
export function optionalAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

      // attach user to request if token is valid
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      };
    }

    // Continue regardless of token presence
    next();
  } catch (err) {
    // If token is invalid, just continue without user
    next();
  }
}
