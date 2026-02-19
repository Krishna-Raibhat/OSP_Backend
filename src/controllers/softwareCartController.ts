import type { Request, Response } from "express";
import { HttpError, validateUUID } from "../utils/errors";
import * as cartService from "../services/softwareCartService";

/* ==================== CART CONTROLLERS ==================== */

// Get user's cart
export async function getCart(req: Request, res: Response) {
  try {
    // Safety check for auth middleware
    if (!req.user?.userId) {
      return res.status(401).json({ message: "Unauthorized. Please log in." });
    }

    const user_id = req.user.userId;
    const userRole = req.user.role;

    const cart = await cartService.getCartWithItems(user_id, userRole);
    return res.status(200).json(cart);
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Get cart error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// Add item to cart
export async function addToCart(req: Request, res: Response) {
  try {
    // Safety check for auth middleware
    if (!req.user?.userId) {
      return res.status(401).json({ message: "Unauthorized. Please log in." });
    }

    const user_id = req.user.userId;
    const userRole = req.user.role;
    const { software_plan_id, quantity = 1 } = req.body;

    if (!software_plan_id) {
      return res.status(400).json({ message: "software_plan_id is required." });
    }

    // Validate UUID
    validateUUID(software_plan_id, "Plan ID");

    // Validate quantity
    const qty = Number(quantity);
    if (isNaN(qty) || qty < 1) {
      return res.status(400).json({ message: "Quantity must be a number greater than 0." });
    }

    await cartService.addToCart({
      user_id,
      software_plan_id,
      quantity: qty,
      userRole,
    });

    const cart = await cartService.getCartWithItems(user_id, userRole);
    return res.status(200).json({ message: "Item added to cart.", cart });
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Add to cart error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// Update cart item quantity
export async function updateCartItem(req: Request, res: Response) {
  try {
    // Safety check for auth middleware
    if (!req.user?.userId) {
      return res.status(401).json({ message: "Unauthorized. Please log in." });
    }

    const user_id = req.user.userId;
    const userRole = req.user.role;
    const cart_item_id = validateUUID(req.params.cart_item_id, "Cart item ID");
    const { quantity } = req.body;

    if (!quantity) {
      return res.status(400).json({ message: "quantity is required." });
    }

    // Validate quantity
    const qty = Number(quantity);
    if (isNaN(qty) || qty < 1) {
      return res.status(400).json({ message: "Quantity must be a number greater than 0." });
    }

    await cartService.updateCartItem({
      user_id,
      cart_item_id,
      quantity: qty,
    });

    const cart = await cartService.getCartWithItems(user_id, userRole);
    return res.status(200).json({ message: "Cart updated.", cart });
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Update cart error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// Remove item from cart
export async function removeCartItem(req: Request, res: Response) {
  try {
    // Safety check for auth middleware
    if (!req.user?.userId) {
      return res.status(401).json({ message: "Unauthorized. Please log in." });
    }

    const user_id = req.user.userId;
    const userRole = req.user.role;
    const cart_item_id = validateUUID(req.params.cart_item_id, "Cart item ID");

    const removedItem = await cartService.removeCartItem(user_id, cart_item_id);

    const cart = await cartService.getCartWithItems(user_id, userRole);
    return res.status(200).json({ message: "Item removed from cart.", data: removedItem, cart });
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Remove cart item error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// Clear cart
export async function clearCart(req: Request, res: Response) {
  try {
    // Safety check for auth middleware
    if (!req.user?.userId) {
      return res.status(401).json({ message: "Unauthorized. Please log in." });
    }

    const user_id = req.user.userId;

    await cartService.clearCart(user_id);
    return res.status(200).json({ message: "Cart cleared." });
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Clear cart error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// Sync cart from frontend (when user logs in)
export async function syncCart(req: Request, res: Response) {
  try {
    // Safety check for auth middleware
    if (!req.user?.userId) {
      return res.status(401).json({ message: "Unauthorized. Please log in." });
    }

    const user_id = req.user.userId;
    const userRole = req.user.role;
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ message: "items array is required." });
    }

    const cart = await cartService.syncCart({
      user_id,
      items,
      userRole,
    });

    return res.status(200).json({ message: "Cart synced.", cart });
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Sync cart error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}
