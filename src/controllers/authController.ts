import type { Request, Response } from "express";
import { HttpError } from "../utils/errors";
import { registerUser, loginUser, getUserProfile, changePassword, updateUserProfile } from "../services/authService";

// Public registration - only allows 'user' role
export async function register(req: Request, res: Response) {
  try {
    // Force role to 'user' for public registration
    const data = await registerUser({ ...req.body, role: "user" });
    return res.status(201).json({ message: "Registered successfully.", ...data });
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Register error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// Admin-only registration - allows creating distributors
export async function registerDistributor(req: Request, res: Response) {
  try {
    // Force role to 'distributor'
    const data = await registerUser({ ...req.body, role: "distributor" });
    return res.status(201).json({ message: "Distributor registered successfully.", ...data });
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Register distributor error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const data = await loginUser(req.body);
    return res.status(200).json({ message: "Login successful.", ...data });
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function getProfile(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new HttpError(401, "Unauthorized.");

    const data = await getUserProfile(userId);
    return res.status(200).json(data);
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Get profile error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function updatePassword(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new HttpError(401, "Unauthorized.");

    const data = await changePassword({ userId, ...req.body });
    return res.status(200).json(data);
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Change password error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function updateProfile(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new HttpError(401, "Unauthorized.");

    const data = await updateUserProfile({ userId, ...req.body });
    return res.status(200).json({ message: "Profile updated successfully.", ...data });
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Update profile error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}
