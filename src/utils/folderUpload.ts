import fs from "fs";
import path from "path";


export async function uploadBrandImageToFolder(
  file: Express.Multer.File,
  brandName: string
): Promise<{ originalPath: string; }> {
  try {
    // Sanitize brand name for folder
    const sanitizedBrandName = brandName.replace(/[^a-zA-Z0-9-_]/g, "_");

    // Create folder paths
    const baseDir = path.join(__dirname, "../../../Images/brands", sanitizedBrandName);
    const originalDir = path.join(baseDir, "original");
    
    [originalDir].forEach((dir) => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });

    // Unique file name
    const fileExtension = file.originalname.split(".").pop();
    const fileName = `${Date.now()}.${fileExtension}`;

    // Paths to save
    const originalPath = path.join(originalDir, fileName);
    

    // Save original file
    fs.writeFileSync(originalPath, file.buffer);


    // Return relative paths for DB storage
    return {
      originalPath: `Images/brands/${sanitizedBrandName}/original/${fileName}`,
    };
  } catch (err) {
    console.error("Folder upload error:", err);
    throw new Error("Failed to upload image to folder");
  }
}

export async function uploadProductQRToFolder(
  file: Express.Multer.File,
  productId: string
): Promise<{ originalPath: string; }> {
  try {
    // Create folder paths
    const baseDir = path.join(__dirname, "../../../Images/product_qr", productId);
    const originalDir = path.join(baseDir, "original");
    
    [originalDir].forEach((dir) => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });

    // Unique file name
    const fileExtension = file.originalname.split(".").pop();
    const fileName = `${Date.now()}.${fileExtension}`;

    // Paths to save
    const originalPath = path.join(originalDir, fileName);
    
    // Save original file
    fs.writeFileSync(originalPath, file.buffer);

    // Return relative paths for DB storage
    return {
      originalPath: `Images/product_qr/${productId}/original/${fileName}`,
    };    } catch (err) {
    console.error("Folder upload error:", err);
    throw new Error("Failed to upload image to folder");
  }
}