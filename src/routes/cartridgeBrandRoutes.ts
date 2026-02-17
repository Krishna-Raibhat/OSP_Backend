import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAdmin } from "../middlewares/roleMiddleware";
import { CartridgeBrandController} from "../controllers/cartridgeBrandController";

const router = Router();

router.post("/", authMiddleware, requireAdmin, CartridgeBrandController.createCartridgeBrand);
router.get("/", authMiddleware, requireAdmin, CartridgeBrandController.getAllCartridgeBrands);
router.get("/:id", authMiddleware, requireAdmin, CartridgeBrandController.getCartridgeBrandById);
router.put("/:id", authMiddleware, requireAdmin, CartridgeBrandController.updateCartridgeBrand);
router.delete("/:id", authMiddleware, requireAdmin, CartridgeBrandController.deleteCartridgeBrand);

export default router;