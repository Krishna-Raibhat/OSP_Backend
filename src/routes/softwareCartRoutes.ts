import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import * as cartController from "../controllers/softwareCartController";

const router = Router();

// All cart routes require authentication
router.use(authMiddleware);

router.get("/", cartController.getCart);
router.post("/", cartController.addToCart);
router.put("/:cart_item_id", cartController.updateCartItem);
router.delete("/:cart_item_id", cartController.removeCartItem);
router.delete("/", cartController.clearCart);
router.post("/sync", cartController.syncCart);

export default router;
