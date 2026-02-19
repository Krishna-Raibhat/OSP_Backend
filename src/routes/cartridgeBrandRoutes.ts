import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAdmin } from "../middlewares/roleMiddleware";
import { uploadBrandImage } from "../middlewares/uploadMiddleware";
import { CartridgeBrandController} from "../controllers/cartridgeBrandController";

const router = Router();

router.post("/", authMiddleware, requireAdmin, uploadBrandImage, CartridgeBrandController.createCartridgeBrand);
router.get("/", authMiddleware, requireAdmin, CartridgeBrandController.getAllCartridgeBrands);
router.get("/:id", authMiddleware, requireAdmin, CartridgeBrandController.getCartridgeBrandById);
router.put("/:id", authMiddleware, requireAdmin, uploadBrandImage, CartridgeBrandController.updateCartridgeBrand);
router.delete("/:id", authMiddleware, requireAdmin, CartridgeBrandController.deleteCartridgeBrand);

export default router;