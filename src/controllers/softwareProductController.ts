import type { Request, Response } from "express";
import { HttpError, validateUUID } from "../utils/errors";
import * as productService from "../services/softwareProductService";

export async function createProduct(req: Request, res: Response) {
  try {
    // Validate UUIDs in request body
    const { brand_id, category_id, ...rest } = req.body;
    
    if (brand_id) validateUUID(brand_id, "Brand ID");
    if (category_id) validateUUID(category_id, "Category ID");
    
    const data = await productService.createProduct(req.body);
    return res.status(201).json({ message: "Product created successfully.", data });
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Create product error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function getAllProducts(_req: Request, res: Response) {
  try {
    const data = await productService.getAllProducts();
    return res.status(200).json(data);
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Get products error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function getProductById(req: Request, res: Response) {
  try {
    const id = validateUUID(req.params.id, "Product ID");
    const data = await productService.getProductById(id);
    return res.status(200).json(data);
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Get product error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function getProductsByBrand(req: Request, res: Response) {
  try {
    const brandId = validateUUID(req.params.brandId, "Brand ID");
    const data = await productService.getProductsByBrand(brandId);
    return res.status(200).json(data);
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Get products by brand error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function updateProduct(req: Request, res: Response) {
  try {
    const id = validateUUID(req.params.id, "Product ID");
    
    // Validate UUIDs in request body
    const { brand_id, category_id } = req.body;
    if (brand_id) validateUUID(brand_id, "Brand ID");
    if (category_id) validateUUID(category_id, "Category ID");
    
    const data = await productService.updateProduct({ id, ...req.body });
    return res.status(200).json({ message: "Product updated successfully.", data });
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Update product error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function deleteProduct(req: Request, res: Response) {
  try {
    const id = validateUUID(req.params.id, "Product ID");
    const data = await productService.deleteProduct(id);
    return res.status(200).json({ message: "Product deleted successfully.", data });
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Delete product error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}
