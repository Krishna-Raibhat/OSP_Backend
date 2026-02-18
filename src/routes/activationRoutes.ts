import { Router } from "express";
import * as activationController from "../controllers/activationController";

const router = Router();

// Public route - no authentication required
router.post("/request-key", activationController.requestActivationKey);

export default router;
