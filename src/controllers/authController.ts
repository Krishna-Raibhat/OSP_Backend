import type { Request, Response } from "express";
import { HttpError } from "../utils/errors";
import { registerUser, loginUser, getUserProfile, changePassword, updateUserProfile, getUsersByRole } from "../services/authService";

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

// Get all users or filter by role (admin only)
export async function getAllUsers(req: Request, res: Response) {
  try {
    const { role } = req.query;
    const users = await getUsersByRole(role as string);
    return res.status(200).json(users);
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Get users error:", err);
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


/* ==================== ADMIN USER MANAGEMENT ==================== */

// Admin: Get user by ID
export async function getUserById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ message: "User ID is required." });
    }

    const { getUserById: getUser } = await import("../services/authService");
    const user = await getUser(id);
    return res.status(200).json(user);
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Get user by ID error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// Admin: Update user
export async function adminUpdateUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ message: "User ID is required." });
    }

    const { adminUpdateUser: updateUser } = await import("../services/authService");
    const user = await updateUser({ userId: id, ...req.body });
    return res.status(200).json({ message: "User updated successfully.", user });
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Admin update user error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// Admin: Delete user
export async function adminDeleteUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ message: "User ID is required." });
    }

    const { adminDeleteUser: deleteUser } = await import("../services/authService");
    const user = await deleteUser(id);
    return res.status(200).json({ message: "User deleted successfully.", user });
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Admin delete user error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// Admin: Activate user
export async function adminActivateUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ message: "User ID is required." });
    }

    const { adminActivateUser: activateUser } = await import("../services/authService");
    const user = await activateUser(id);
    return res.status(200).json({ message: "User activated successfully.", user });
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Admin activate user error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// Admin: Deactivate user
export async function adminDeactivateUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ message: "User ID is required." });
    }

    const { adminDeactivateUser: deactivateUser } = await import("../services/authService");
    const user = await deactivateUser(id);
    return res.status(200).json({ message: "User deactivated successfully.", user });
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Admin deactivate user error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}
