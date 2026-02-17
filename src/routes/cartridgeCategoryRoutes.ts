import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAdmin } from "../middlewares/roleMiddleware";

import * as categoryController from "../controllers/cartridgeCategoryController";

const router = Router();

router.post("/", authMiddleware, requireAdmin, categoryController.createCategory);
router.get("/", categoryController.getAllCategories);
router.get("/:id", categoryController.getCategoryById);
router.put("/:id", authMiddleware, requireAdmin, categoryController.updateCategory);
router.delete("/:id", authMiddleware, requireAdmin, categoryController.deleteCategory);

export default router;  