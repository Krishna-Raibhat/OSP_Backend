import type { Request, Response } from "express";
import { HttpError } from "../utils/errors";
import * as brandService from "../services/softwareBrandService";
import { uploadBrandImageToS3 } from "../utils/s3Upload";

export async function createBrand(req: Request, res: Response) {
  try {
    const { name, is_active } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Brand name is required." });
    }

    // Image is required when creating brand
    if (!req.file) {
      return res.status(400).json({ message: "Brand image is required." });
    }

    // Upload image to S3 first
    const { originalPath, thumbnailPath } = await uploadBrandImageToS3(req.file, name);

    // Create brand with image paths
    const brandData = await brandService.createBrand({
      name,
      is_active,
      thumbnail_url: thumbnailPath,
      original_url: originalPath,
    });

    return res.status(201).json({ 
      message: "Brand created successfully.", 
      data: brandData 
    });
  } catch (err: any) {
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
    
    // Get existing brand to get the name
    const existingBrand = await brandService.getBrandById(id);
    const brandName = req.body.name || existingBrand.name;
    
    let thumbnail_url = undefined;
    let original_url = undefined;

    // Upload new image to S3 if provided
    if (req.file) {
      const { originalPath, thumbnailPath } = await uploadBrandImageToS3(req.file, brandName);
      original_url = originalPath;
      thumbnail_url = thumbnailPath;
    }

    const data = await brandService.updateBrand({ 
      id, 
      ...req.body,
      ...(thumbnail_url !== undefined && { thumbnail_url }),
      ...(original_url !== undefined && { original_url }),
    });

    return res.status(200).json({ 
      message: "Brand updated successfully.", 
      data 
    });
  } catch (err: any) {
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
