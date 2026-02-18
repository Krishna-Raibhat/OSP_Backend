import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAdmin } from "../middlewares/roleMiddleware";
import * as paymentController from "../controllers/softwarePaymentController";

const router = Router();

// Public/Customer routes
router.post("/cod", paymentController.createCODPayment); // Create COD payment
router.get("/order/:order_id", paymentController.getPaymentByOrderId); // Get payment status

// Admin routes
router.get(
  "/cod/pending",
  authMiddleware,
  requireAdmin,
  paymentController.getPendingCODPayments
); // Get all pending COD payments

router.post(
  "/cod/:payment_id/confirm",
  authMiddleware,
  requireAdmin,
  paymentController.confirmCODPayment
); // Confirm COD payment received

router.post(
  "/manual",
  authMiddleware,
  requireAdmin,
  paymentController.createManualPayment
); // Create manual payment

export default router;
