import { Router } from "express";
import { login, register, registerDistributor, getProfile, updatePassword, updateProfile } from "../controllers/authController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { roleMiddleware } from "../middlewares/roleMiddleware";

const router = Router();

// Public routes
router.post("/register", register); // Only creates 'user' role
router.post("/login", login);

// Admin-only route to register distributors
router.post("/register-distributor", authMiddleware, roleMiddleware(["admin"]), registerDistributor);

// Protected routes
router.get("/profile", authMiddleware, getProfile);
router.put("/profile", authMiddleware, updateProfile);
router.put("/change-password", authMiddleware, updatePassword);

export default router;
