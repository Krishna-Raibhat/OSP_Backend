import type { Request, Response } from "express";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { HttpError } from "../utils/errors";
import * as brandService from "../services/softwareBrandService";
import { uploadBrandImageToS3 } from "../utils/s3Upload";
import { env } from "../utils/env";

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

// Initialize S3 client once (reused across requests)
let s3ClientInstance: S3Client | null = null;

function getS3ClientInstance(): S3Client {
  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
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
