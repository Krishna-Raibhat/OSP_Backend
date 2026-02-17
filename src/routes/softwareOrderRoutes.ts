import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAdmin } from "../middlewares/roleMiddleware";
import * as orderController from "../controllers/softwareOrderController";

const router = Router();

// Public routes (no auth required)
router.post("/track", orderController.trackGuestOrder); // Track guest order
router.post("/create", orderController.createOrder); // Create order (guest or logged-in)

// Protected routes (auth required)
router.post("/from-cart", authMiddleware, orderController.createOrderFromCart); // Create from cart
router.get("/", authMiddleware, orderController.getUserOrders); // Get user's orders
router.get("/:order_id", authMiddleware, orderController.getOrder); // Get specific order

// Admin routes
router.get(
  "/admin/all",
  authMiddleware,
  requireAdmin,
  orderController.getAllOrdersAdmin
); // Get all orders with filters

router.get(
  "/admin/details/:order_id",
  authMiddleware,
  requireAdmin,
  orderController.getOrderDetailsAdmin
); // Get order details with serial numbers

export default router;
