import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAdmin } from "../middlewares/roleMiddleware";
import { uploadBrandImage } from "../middlewares/uploadMiddleware";
import * as brandController from "../controllers/softwareBrandController";

const router = Router();

router.post("/", authMiddleware, requireAdmin, uploadBrandImage, brandController.createBrand);
router.get("/", brandController.getAllBrands);
router.get("/:id", brandController.getBrandById);
router.put("/:id", authMiddleware, requireAdmin, uploadBrandImage, brandController.updateBrand);
router.delete("/:id", authMiddleware, requireAdmin, brandController.deleteBrand);

export default router;
