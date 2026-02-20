import { Router } from "express";
import { 
  login, 
  register, 
  registerDistributor, 
  getAllUsers, 
  getProfile, 
  updatePassword, 
  updateProfile,
  getUserById,
  adminUpdateUser,
  adminDeleteUser,
  adminActivateUser,
  adminDeactivateUser
} from "../controllers/authController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAdmin } from "../middlewares/roleMiddleware";

const router = Router();

// Public routes
router.post("/register", register); // Only creates 'user' role
router.post("/login", login);

// Admin-only routes
router.post("/register-distributor", authMiddleware, requireAdmin, registerDistributor);
router.get("/users", authMiddleware, requireAdmin, getAllUsers); // Get all users or filter by role
router.get("/users/:id", authMiddleware, requireAdmin, getUserById); // Get user by ID
router.put("/users/:id", authMiddleware, requireAdmin, adminUpdateUser); // Update user
router.delete("/users/:id", authMiddleware, requireAdmin, adminDeleteUser); // Delete user
router.post("/users/:id/activate", authMiddleware, requireAdmin, adminActivateUser); // Activate user
router.post("/users/:id/deactivate", authMiddleware, requireAdmin, adminDeactivateUser); // Deactivate user

// Protected routes
router.get("/profile", authMiddleware, getProfile);
router.put("/profile", authMiddleware, updateProfile);
router.put("/change-password", authMiddleware, updatePassword);

export default router;
