import { Router } from "express";
import * as orderController from "../controllers/cartridgeOrderController";
import { authMiddleware, optionalAuthMiddleware } from "../middlewares/authMiddleware";
import { requireAdmin } from "../middlewares/roleMiddleware";

const router = Router();

// Customer routes
router.post("/from-cart", optionalAuthMiddleware, orderController.createOrderFromCart);
router.post("/track", orderController.trackGuestOrder);

// Authenticated user routes
router.get("/my-orders", authMiddleware, orderController.getUserOrders);
router.get("/:order_id", authMiddleware, orderController.getOrder);

// Admin routes
router.get("/admin/all", authMiddleware, requireAdmin, orderController.getAllOrdersAdmin);
router.get("/admin/details/:order_id", authMiddleware, requireAdmin, orderController.getOrderDetailsAdmin);

export default router;
