import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { env } from "./env";
import dns from "dns";

// Set DNS resolution order to prefer IPv4
dns.setDefaultResultOrder("ipv4first");

// Initialize S3 client with lazy loading
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
      },
      endpoint: env.AWS_ENDPOINT,
      forcePathStyle: true,
      maxAttempts: 3,
      requestHandler: {
        connectionTimeout: 10000,
        socketTimeout: 30000,
      },
    });
  }
  return s3Client;
}

export async function uploadBrandImageToS3(
  file: Express.Multer.File,
  brandName: string
): Promise<{ originalPath: string; thumbnailPath: string }> {
  const fileExtension = file.originalname.split(".").pop();
  const fileName = `${Date.now()}.${fileExtension}`;

  // Sanitize brand name for folder path (remove special characters)
  const sanitizedBrandName = brandName.replace(/[^a-zA-Z0-9-_]/g, "_");

  // Paths in S3 (store only path, not full URL)
  const originalPath = `Software/brands/${sanitizedBrandName}/original/${fileName}`;
  const thumbnailPath = `Software/brands/${sanitizedBrandName}/thumbnail/${fileName}`;

  try {
    const client = getS3Client();

    // Upload original image
    const originalUpload = new PutObjectCommand({
      Bucket: env.AWS_BUCKET_NAME!,
      Key: originalPath,
      Body: file.buffer,
      ContentType: file.mimetype,
    });
    await client.send(originalUpload);

    // Create and upload thumbnail (compressed, max 300x300)
    const thumbnailBuffer = await sharp(file.buffer)
      .resize(300, 300, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    const thumbnailUpload = new PutObjectCommand({
      Bucket: env.AWS_BUCKET_NAME!,
      Key: thumbnailPath,
      Body: thumbnailBuffer,
      ContentType: "image/jpeg",
    });
    await client.send(thumbnailUpload);

    // Return only paths (not full URLs)
    return {
      originalPath,
      thumbnailPath,
    };
  } catch (error) {
    console.error("S3 upload error:", error);
    throw new Error("Failed to upload image to S3");
  }
}

// Helper to get full URL from path
export function getS3Url(path: string): string {
  return `${env.AWS_ENDPOINT}/${env.AWS_BUCKET_NAME}/${path}`;
}

export async function uploadCartridgeBrandImageToS3(
  file: Express.Multer.File,
  brandName: string
): Promise<{ originalPath: string; thumbnailPath: string }> {
  const fileExtension = file.originalname.split(".").pop();
  const fileName = `${Date.now()}.${fileExtension}`;

  // Sanitize brand name for folder path (remove special characters)
  const sanitizedBrandName = brandName.replace(/[^a-zA-Z0-9-_]/g, "_");

  // Paths in S3 (store only path, not full URL)
  const originalPath = `Cartridge/Brands/${sanitizedBrandName}/original/${fileName}`;
  const thumbnailPath = `Cartridge/Brands/${sanitizedBrandName}/thumbnail/${fileName}`;

  try {
    const client = getS3Client();

    // Upload original image
    const originalUpload = new PutObjectCommand({
      Bucket: env.AWS_BUCKET_NAME!,
      Key: originalPath,
      Body: file.buffer,
      ContentType: file.mimetype,
    });
    await client.send(originalUpload);

    // Create and upload thumbnail (compressed, max 300x300)
    const thumbnailBuffer = await sharp(file.buffer)
      .resize(300, 300, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    const thumbnailUpload = new PutObjectCommand({
      Bucket: env.AWS_BUCKET_NAME!,
      Key: thumbnailPath,
      Body: thumbnailBuffer,
      ContentType: "image/jpeg",
    });
    await client.send(thumbnailUpload);

    // Return only paths (not full URLs)
    return {
      originalPath,
      thumbnailPath,
    };
  } catch (error) {
    console.error("S3 upload error:", error);
    throw new Error("Failed to upload image to S3");
  }
}
