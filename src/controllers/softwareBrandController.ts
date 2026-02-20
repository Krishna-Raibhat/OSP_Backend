import type { Request, Response } from "express";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { HttpError, validateUUID } from "../utils/errors";
import * as brandService from "../services/softwareBrandService";
import { uploadBrandImageToS3 } from "../utils/s3Upload";
import { env } from "../utils/env";

// Helper to parse is_active from multipart/form-data
function parseIsActive(value: any): boolean {
  if (value === undefined) return true; // default
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    return !(lower === 'false' || lower === '0' || lower === '');
  }
  return Boolean(value);
}

// Helper to normalize category_id (trim whitespace, convert empty to undefined)
function normalizeCategoryId(value: any): string | undefined {
  if (value === undefined) return undefined;
  if (!value) return undefined; // null, empty string, etc. become undefined
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }
  return value;
}

export async function createBrand(req: Request, res: Response) {
  try {
    const { name, category_id, is_active } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Brand name is required." });
    }

    // Image is required when creating brand
    if (!req.file) {
      return res.status(400).json({ message: "Brand image is required." });
    }

    // Use helper functions for parsing
    const normalizedCategoryId = normalizeCategoryId(category_id);
    const isActiveBoolean = parseIsActive(is_active);

    // Upload image to S3 first
    const { originalPath, thumbnailPath } = await uploadBrandImageToS3(req.file, name);

    // Create brand with image paths
    const brandData = await brandService.createBrand({
      name,
      category_id: normalizedCategoryId,
      is_active: isActiveBoolean,
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
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Get brands error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function getBrandById(req: Request, res: Response) {
  try {
    const id = validateUUID(req.params.id, "Brand ID");
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
    const id = validateUUID(req.params.id, "Brand ID");
    
    // Use helper functions for parsing
    const parsedIsActive = req.body.is_active !== undefined 
      ? parseIsActive(req.body.is_active) 
      : undefined;
    const normalizedCategoryId = normalizeCategoryId(req.body.category_id);
    
    let thumbnail_url = undefined;
    let original_url = undefined;

    // Upload new image to S3 if provided
    if (req.file) {
      // Get existing brand only if we need the name for S3 upload
      const existingBrand = await brandService.getBrandById(id);
      const brandName = req.body.name || existingBrand.name;
      
      const { originalPath, thumbnailPath } = await uploadBrandImageToS3(req.file, brandName);
      original_url = originalPath;
      thumbnail_url = thumbnailPath;
    }

    const data = await brandService.updateBrand({ 
      id, 
      ...req.body,
      ...(parsedIsActive !== undefined && { is_active: parsedIsActive }),
      ...(normalizedCategoryId !== undefined && { category_id: normalizedCategoryId }),
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
    const id = validateUUID(req.params.id, "Brand ID");
    const data = await brandService.deleteBrand(id);
    return res.status(200).json({ message: "Brand deleted successfully.", data });
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Delete brand error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// Initialize S3 client once (reused across requests)
let s3ClientInstance: S3Client | null = null;

function getS3ClientInstance(): S3Client {
  if (!s3ClientInstance) {
    // Validate credentials
    const accessKeyId = env.AWS_ACCESS_KEY_ID?.trim();
    const secretAccessKey = env.AWS_SECRET_ACCESS_KEY?.trim();
    
    if (!accessKeyId || !secretAccessKey) {
      throw new Error("AWS credentials are not properly configured. Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env");
    }
    
    s3ClientInstance = new S3Client({
      region: env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      endpoint: env.AWS_ENDPOINT,
      forcePathStyle: true,
    });
  }
  return s3ClientInstance;
}

export async function getBrandImage(req: Request, res: Response) {
  try {
    const { path } = req.query;

    if (!path || typeof path !== "string") {
      return res.status(400).json({ message: "Image path is required." });
    }

    // Get S3 client
    const s3Client = getS3ClientInstance();

    // Get object from S3
    const command = new GetObjectCommand({
      Bucket: env.AWS_BUCKET_NAME!,
      Key: path,
    });

    const response = await s3Client.send(command);

    // Set CORS headers explicitly for images (MUST be set before streaming)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

    // Set content type
    if (response.ContentType) {
      res.setHeader("Content-Type", response.ContentType);
    }

    // Set cache headers (cache for 1 year)
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    // Stream the image
    if (response.Body) {
      const stream = response.Body as any;
      stream.pipe(res);
      return; // Early return to prevent double response
    } else {
      return res.status(404).json({ message: "Image not found." });
    }
  } catch (err: any) {
    console.error("Get brand image error:", err);
    if (err.name === "NoSuchKey") {
      return res.status(404).json({ message: "Image not found." });
    }
    return res.status(500).json({ message: "Server error." });
  }
}
