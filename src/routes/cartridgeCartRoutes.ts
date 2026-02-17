import { Router } from "express";
import * as cartController from "../controllers/cartridgeCartController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

// All cart routes require authentication
router.use(authMiddleware);

router.get("/", cartController.getCart);
router.post("/add", cartController.addToCart);
router.put("/items/:cart_item_id", cartController.updateCartItem);
router.delete("/items/:cart_item_id", cartController.removeCartItem);
router.delete("/clear", cartController.clearCart);
router.post("/sync", cartController.syncCart);

export default router;
