import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAdmin } from "../middlewares/roleMiddleware";
import * as productController from "../controllers/softwareProductController";

const router = Router();

router.post("/", authMiddleware, requireAdmin, productController.createProduct);
router.get("/", productController.getAllProducts);
router.get("/:id", productController.getProductById);
router.put("/:id", authMiddleware, requireAdmin, productController.updateProduct);
router.delete("/:id", authMiddleware, requireAdmin, productController.deleteProduct);

export default router;
