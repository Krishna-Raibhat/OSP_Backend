import { Router } from "express";
import * as paymentController from "../controllers/cartridgePaymentController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAdmin } from "../middlewares/roleMiddleware";

const router = Router();

// Customer routes
router.post("/cod", paymentController.createCODPayment);
router.get("/order/:order_id", paymentController.getPaymentByOrderId);

// Admin routes
router.get("/admin/pending-cod", authMiddleware, requireAdmin, paymentController.getPendingCODPayments);
router.post("/admin/confirm-cod/:payment_id", authMiddleware, requireAdmin, paymentController.confirmCODPayment);
router.post("/admin/manual", authMiddleware, requireAdmin, paymentController.createManualPayment);

export default router;
