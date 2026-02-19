import type { Request, Response } from "express";
import { HttpError, validateUUID } from "../utils/errors";
import * as paymentService from "../services/softwarePaymentService";

/* ==================== PAYMENT CONTROLLERS ==================== */

// Create COD payment (customer)
export async function createCODPayment(req: Request, res: Response) {
  try {
    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({ message: "order_id is required." });
    }

    validateUUID(order_id, "Order ID");

    const payment = await paymentService.createCODPayment(order_id);

    return res.status(201).json({
      message: "COD payment created. Order will be processed after payment confirmation.",
      payment,
    });
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Create COD payment error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// Get payment by order ID
export async function getPaymentByOrderId(req: Request, res: Response) {
  try {
    const order_id = validateUUID(req.params.order_id, "Order ID");

    const payment = await paymentService.getPaymentByOrderId(order_id);
    return res.status(200).json(payment);
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Get payment error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// Admin: Get pending COD payments
export async function getPendingCODPayments(req: Request, res: Response) {
  try {
    const payments = await paymentService.getPendingCODPayments();
    return res.status(200).json(payments);
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Get pending COD payments error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// Admin: Confirm COD payment
export async function confirmCODPayment(req: Request, res: Response) {
  try {
    const payment_id = validateUUID(req.params.payment_id, "Payment ID");
    const { manual_reference } = req.body;

    const result = await paymentService.confirmCODPayment({
      payment_id,
      manual_reference,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Confirm COD payment error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// Admin: Create manual payment
export async function createManualPayment(req: Request, res: Response) {
  try {
    const { order_id, amount, manual_reference } = req.body;

    if (!order_id || !amount || !manual_reference) {
      return res.status(400).json({ 
        message: "order_id, amount, and manual_reference are required." 
      });
    }

    validateUUID(order_id, "Order ID");

    const payment = await paymentService.createManualPayment({
      order_id,
      amount: Number(amount),
      manual_reference,
    });

    return res.status(201).json({
      message: "Manual payment recorded and licenses generated.",
      payment,
    });
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Create manual payment error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}
