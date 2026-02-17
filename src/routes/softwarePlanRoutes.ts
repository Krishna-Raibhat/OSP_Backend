import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAdmin } from "../middlewares/roleMiddleware";
import * as planController from "../controllers/softwarePlanController";

const router = Router();

router.post("/", authMiddleware, requireAdmin, planController.createPlan);
router.get("/", planController.getAllPlans);
router.get("/:id", planController.getPlanById);
router.put("/:id", authMiddleware, requireAdmin, planController.updatePlan);
router.delete("/:id", authMiddleware, requireAdmin, planController.deletePlan);

export default router;
