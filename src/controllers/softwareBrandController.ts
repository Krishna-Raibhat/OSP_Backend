import type { Request, Response } from "express";
import { HttpError } from "../utils/errors";
import * as brandService from "../services/softwareBrandService";
import fs from "fs";
import path from "path";

export async function createBrand(req: Request, res: Response) {
  try {
    // Get image path if uploaded
    const image_url = req.file ? `/uploads/brands/${req.file.filename}` : null;
    
    const data = await brandService.createBrand({
      ...req.body,
      image_url,
    });
    return res.status(201).json({ message: "Brand created successfully.", data });
  } catch (err: any) {
    // Delete uploaded file if brand creation failed
    if (req.file) {
      const filePath = path.join(process.cwd(), "uploads", "brands", req.file.filename);
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting file:", unlinkErr);
      });
    }
    
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Create brand error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function getAllBrands(req: Request, res: Response) {
  try {
    const data = await brandService.getAllBrands();
    return res.status(200).json(data);
  } catch (err: any) {
    console.error("Get brands error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function getBrandById(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const data = await brandService.getBrandById(id);
    return res.status(200).json(data);
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Get brand error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function updateBrand(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    
    // Get image path if uploaded
    const image_url = req.file ? `/uploads/brands/${req.file.filename}` : undefined;
    
    const data = await brandService.updateBrand({ 
      id, 
      ...req.body,
      ...(image_url !== undefined && { image_url }),
    });
    return res.status(200).json({ message: "Brand updated successfully.", data });
  } catch (err: any) {
    // Delete uploaded file if update failed
    if (req.file) {
      const filePath = path.join(process.cwd(), "uploads", "brands", req.file.filename);
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting file:", unlinkErr);
      });
    }
    
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Update brand error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function deleteBrand(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const data = await brandService.deleteBrand(id);
    return res.status(200).json(data);
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Delete brand error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}
