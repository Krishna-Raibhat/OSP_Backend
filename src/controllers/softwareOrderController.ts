import type { Request, Response } from "express";
import { HttpError } from "../utils/errors";
import * as orderService from "../services/softwareOrderService";

/* ==================== ORDER CONTROLLERS ==================== */

// Create order from cart (logged-in user)
export async function createOrderFromCart(req: Request, res: Response) {
  try {
    const user_id = req.user!.userId;
    const { billing_info, payment_method = "gateway" } = req.body;

    if (!billing_info) {
      return res.status(400).json({ message: "billing_info is required." });
    }

    if (!payment_method || !["gateway", "cod"].includes(payment_method)) {
      return res.status(400).json({ message: "payment_method must be 'gateway' or 'cod'." });
    }

    const result = await orderService.createOrderFromCart({
      user_id,
      billing_info,
      payment_method,
    });

    return res.status(201).json({
      message: "Order and payment created successfully.",
      order: result.order,
      payment: result.payment,
    });
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Create order error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// Create order directly (guest or logged-in user)
export async function createOrder(req: Request, res: Response) {
  try {
    const user_id = req.user?.userId; // Optional for guest
    const { billing_info, items, payment_method = "gateway" } = req.body;

    if (!billing_info) {
      return res.status(400).json({ message: "billing_info is required." });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "items array is required." });
    }

    if (!payment_method || !["gateway", "cod"].includes(payment_method)) {
      return res.status(400).json({ message: "payment_method must be 'gateway' or 'cod'." });
    }

    const result = await orderService.createOrder({
      user_id,
      billing_info,
      items,
      payment_method,
    });

    return res.status(201).json({
      message: "Order and payment created successfully.",
      order: result.order,
      payment: result.payment,
    });
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Create order error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// Get order by ID (logged-in user)
export async function getOrder(req: Request, res: Response) {
  try {
    const user_id = req.user!.userId;
    const order_id = String(req.params.order_id);

    const order = await orderService.getOrderById(order_id, user_id);
    return res.status(200).json(order);
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Get order error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// Get user's orders
export async function getUserOrders(req: Request, res: Response) {
  try {
    const user_id = req.user!.userId;

    const orders = await orderService.getUserOrders(user_id);
    return res.status(200).json(orders);
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Get orders error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// Track guest order (no authentication required)
export async function trackGuestOrder(req: Request, res: Response) {
  try {
    const { order_id, email } = req.body;

    if (!order_id || !email) {
      return res.status(400).json({ message: "order_id and email are required." });
    }

    const order = await orderService.getGuestOrder(order_id, email);
    return res.status(200).json(order);
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Track order error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}
