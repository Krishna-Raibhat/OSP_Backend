import { Request, Response } from "express";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { HttpError } from "../utils/errors";
import { CartridgeBrandService } from "../services/cartridgeBrandService";
import { uploadCartridgeBrandImageToS3 } from "../utils/s3Upload";
import { env } from "../utils/env";
import { validate as isUUID } from "uuid";

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

export const CartridgeBrandController = {
  async createCartridgeBrand(req: Request, res: Response) {
    try {
      const { name, is_active } = req.body;
      if (!name) throw new HttpError(400, "Brand name is required.");

      // Image is required when creating brand
      if (!req.file) {
        return res.status(400).json({ message: "Brand image is required." });
      }

      // Upload image to S3
      const { originalPath, thumbnailPath } = await uploadCartridgeBrandImageToS3(req.file, name);

      // Create brand with S3 paths
      const brand = await CartridgeBrandService.createCartridgeBrand({
        name,
        thumbnail_url: thumbnailPath,
        original_url: originalPath,
        is_active,
      });

      return res.status(201).json({ 
        message: "Brand created successfully.", 
        data: brand 
      });
    } catch (err: any) {
      if (err instanceof HttpError)
        return res.status(err.status).json({ message: err.message });
      console.error("Create brand error:", err);
      return res.status(500).json({ message: "Server error." });
    }
  },

  async getAllCartridgeBrands(req: Request, res: Response) {
    try {
      const brands = await CartridgeBrandService.getAllCartridgeBrands();
      return res.status(200).json({ brands });
    } catch (err: any) {
      console.error("Get brands error:", err);
      return res.status(500).json({ message: "Server error." });
    }
  },

  async getCartridgeBrandById(req: Request<{ id: string }>, res: Response) {
    try {
      const { id } = req.params;
      if (!id) {
        return res
          .status(400)
          .json({ message: "Missing required parameter: id" });
      }
      if (!isUUID(id)) {
        return res
          .status(400)
          .json({ message: "Invalid ID format. ID must be a valid UUID." });
      }
      const brand = await CartridgeBrandService.getCartridgeBrandById(id);
      if (!brand) throw new HttpError(404, "Brand not found.");
      return res.status(200).json({ brand });
    } catch (err: any) {
      if (err instanceof HttpError)
        return res.status(err.status).json({ message: err.message });
      console.error("Get brand by ID error:", err);
      return res.status(500).json({ message: "Server error." });
    }
  },

  async updateCartridgeBrand(req: Request<{ id: string }>, res: Response) {
    try {
      const { id } = req.params;
      if (!id) {
        return res
          .status(400)
          .json({ message: "Missing required parameter: id" });
      } else if (!isUUID(id)) {
        return res
          .status(400)
          .json({ message: "Invalid ID format. ID must be a valid UUID." });
      }
      const { name, is_active } = req.body;

      // Check if at least one field or image is provided
      if (!name && typeof is_active !== "boolean" && !req.file) {
        throw new HttpError(
          400,
          "At least one of name, is_active, or image must be provided.",
        );
      }

      // Get current brand to use existing name if needed
      const currentBrand = await CartridgeBrandService.getCartridgeBrandById(id);
      if (!currentBrand) throw new HttpError(404, "Brand not found.");

      let thumbnail_url = undefined;
      let original_url = undefined;

      // Upload new image to S3 if provided
      if (req.file) {
        const brandName = name || currentBrand.name;
        const { originalPath, thumbnailPath } = await uploadCartridgeBrandImageToS3(req.file, brandName);
        original_url = originalPath;
        thumbnail_url = thumbnailPath;
      }

      const brand = await CartridgeBrandService.updateCartridgeBrand({
        id,
        name,
        is_active,
        ...(thumbnail_url !== undefined && { thumbnail_url }),
        ...(original_url !== undefined && { original_url }),
      });

      return res.status(200).json({ 
        message: "Brand updated successfully.", 
        data: brand 
      });
    } catch (err: any) {
      if (err instanceof HttpError)
        return res.status(err.status).json({ message: err.message });
      console.error("Update brand error:", err);
      return res.status(500).json({ message: "Server error." });
    }
  },

  async deleteCartridgeBrand(req: Request<{ id: string }>, res: Response) {
    try {
      const { id } = req.params;
      if (!id) {
        return res
          .status(400)
          .json({ message: "Missing required parameter: id" });
      } else if (!isUUID(id)) {
        return res
          .status(400)
          .json({ message: "Invalid ID format. ID must be a valid UUID." });
      }
      await CartridgeBrandService.deleteCartridgeBrand(id);
      return res.status(200).json({ message: "Brand deleted successfully." });
    } catch (err: any) {
      if (err instanceof HttpError)
        return res.status(err.status).json({ message: err.message });
      console.error("Delete brand error:", err);
      return res.status(500).json({ message: "Server error." });
    }
  },

  async getCartridgeBrandImage(req: Request, res: Response) {
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
  },
};
