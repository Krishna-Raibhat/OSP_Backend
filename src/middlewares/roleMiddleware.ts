import { Request, Response, NextFunction } from "express";
import { HttpError } from "../utils/errors";

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    const userRole = req.user?.role;

    if (!userRole) {
      throw new HttpError(401, "Unauthorized. No user information.");
    }

    if (userRole !== "admin") {
      throw new HttpError(403, "Forbidden. Admin access required.");
    }

    next();
  } catch (err) {
    next(err);
  }
}

export function requireAdminOrDistributor(req: Request, _res: Response, next: NextFunction) {
  try {
    const userRole = req.user?.role;

    if (!userRole) {
      throw new HttpError(401, "Unauthorized. No user information.");
    }

    if (userRole !== "admin" && userRole !== "distributor") {
      throw new HttpError(403, "Forbidden. Admin or Distributor access required.");
    }

    next();
  } catch (err) {
    next(err);
  }
}
