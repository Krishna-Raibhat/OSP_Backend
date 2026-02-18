import { Router } from "express";
import { login, register, registerDistributor, getAllUsers, getProfile, updatePassword, updateProfile } from "../controllers/authController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAdmin } from "../middlewares/roleMiddleware";

const router = Router();

// Public routes
router.post("/register", register); // Only creates 'user' role
router.post("/login", login);

// Admin-only routes
router.post("/register-distributor", authMiddleware, requireAdmin, registerDistributor);
router.get("/users", authMiddleware, requireAdmin, getAllUsers); // Get all users or filter by role

// Protected routes
router.get("/profile", authMiddleware, getProfile);
router.put("/profile", authMiddleware, updateProfile);
router.put("/change-password", authMiddleware, updatePassword);

export default router;
