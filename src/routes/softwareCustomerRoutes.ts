import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import * as customerController from "../controllers/softwareCustomerController";

const router = Router();

// Public routes (no auth required)
router.get("/brands", customerController.getBrands);
router.get("/categories", customerController.getCategories);

// Optional auth routes (pricing changes based on role if logged in)
router.get("/products", customerController.getAllProducts);
router.get("/brands/:brandId/products", customerController.getProductsByBrand);

// Checkout route (optional auth for role-based pricing)
router.get("/plans/:planId/checkout", customerController.getPlanForCheckout);

export default router;
