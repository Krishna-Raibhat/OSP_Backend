import type { Request, Response } from "express";
import { HttpError } from "../utils/errors";
import * as customerService from "../services/softwareCustomerService";

// Get all active brands
export async function getBrands(req: Request, res: Response) {
  try {
    const data = await customerService.getActiveBrands();
    return res.status(200).json(data);
  } catch (err: any) {
    console.error("Get brands error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// Get all active categories
export async function getCategories(req: Request, res: Response) {
  try {
    const data = await customerService.getActiveCategories();
    return res.status(200).json(data);
  } catch (err: any) {
    console.error("Get categories error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// Get products by brand with role-based pricing
export async function getProductsByBrand(req: Request, res: Response) {
  try {
    const brandId = String(req.params.brandId);
    const userRole = req.user?.role; // Optional, can be undefined for public access
    
    const data = await customerService.getProductsByBrandForCustomer(brandId, userRole);
    return res.status(200).json(data);
  } catch (err: any) {
    console.error("Get products by brand error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// Get all products with role-based pricing
export async function getAllProducts(req: Request, res: Response) {
  try {
    const userRole = req.user?.role; // Optional
    
    const data = await customerService.getAllProductsForCustomer(userRole);
    return res.status(200).json(data);
  } catch (err: any) {
    console.error("Get all products error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// Get plan details for checkout
export async function getPlanForCheckout(req: Request, res: Response) {
  try {
    const planId = String(req.params.planId);
    const userRole = req.user?.role;
    
    const data = await customerService.getPlanForCheckout(planId, userRole);
    return res.status(200).json(data);
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Get plan for checkout error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}
