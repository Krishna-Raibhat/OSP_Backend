import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAdmin } from "../middlewares/roleMiddleware";

import * as qrController from "../controllers/cartridgeProductQrController";

const router = Router();

router.get("/",authMiddleware, requireAdmin, qrController.getAllQrCodes);
router.get("/:productId",authMiddleware, requireAdmin, qrController.getQrCodeByProductId);
router.post("/:productId/deactivate", authMiddleware, requireAdmin, qrController.deactivateQrCode);
router.post("/:productId/reactivate", authMiddleware, requireAdmin, qrController.reactivateQrCode);
router.delete("/:productId", authMiddleware, requireAdmin, qrController.deleteQrCode);

export default router;