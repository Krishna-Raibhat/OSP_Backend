import type { Request, Response } from "express";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { HttpError, validateUUID } from "../utils/errors";
import * as brandService from "../services/softwareBrandService";
import { uploadBrandImageToS3, deleteBrandImages } from "../utils/s3Upload";
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

    // Use helper function for parsing
    const isActiveBoolean = parseIsActive(is_active);

    // Upload image to S3 first
    const { originalPath, thumbnailPath } = await uploadBrandImageToS3(req.file, name);

    // Create brand with image paths
    const brandData = await brandService.createBrand({
      name,
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
    
    // Use helper function for parsing
    const parsedIsActive = req.body.is_active !== undefined 
      ? parseIsActive(req.body.is_active) 
      : undefined;
    
    let thumbnail_url = undefined;
    let original_url = undefined;

    // Upload new image to S3 if provided
    if (req.file) {
      console.log(`Updating brand ${id} with new image`);
      
      // Get existing brand to retrieve old image paths and name
      const existingBrand = await brandService.getBrandById(id);
      console.log(`Existing brand images - Original: ${existingBrand.original_url}, Thumbnail: ${existingBrand.thumbnail_url}`);
      
      const brandName = req.body.name || existingBrand.name;
      
      // Upload new images
      const { originalPath, thumbnailPath } = await uploadBrandImageToS3(req.file, brandName);
      console.log(`New images uploaded - Original: ${originalPath}, Thumbnail: ${thumbnailPath}`);
      original_url = originalPath;
      thumbnail_url = thumbnailPath;
      
      // Delete old images from S3 (await to ensure it completes)
      try {
        await deleteBrandImages(existingBrand.original_url, existingBrand.thumbnail_url);
        console.log("Old brand images deleted successfully");
      } catch (err) {
        console.error("Failed to delete old brand images:", err);
        // Continue anyway - deletion failure shouldn't block the update
      }
    }

    const data = await brandService.updateBrand({ 
      id, 
      ...req.body,
      ...(parsedIsActive !== undefined && { is_active: parsedIsActive }),
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
    
    // Get brand first to retrieve image paths
    const existingBrand = await brandService.getBrandById(id);
    console.log(`Deleting brand ${id} with images - Original: ${existingBrand.original_url}, Thumbnail: ${existingBrand.thumbnail_url}`);
    
    // Delete from database
    const data = await brandService.deleteBrand(id);
    
    // Delete images from S3 (await to ensure it completes)
    try {
      await deleteBrandImages(existingBrand.original_url, existingBrand.thumbnail_url);
      console.log("Brand images deleted from S3 successfully");
    } catch (err) {
      console.error("Failed to delete brand images from S3:", err);
      // Continue anyway - deletion failure shouldn't block the response
    }
    
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
