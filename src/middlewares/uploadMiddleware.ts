import multer from "multer";

// Use memory storage for S3 upload
const storage = multer.memoryStorage();

// File filter - only images
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed."));
  }
};

// Multer upload instance
export const uploadBrandImage = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
}).single("image"); // Field name is "image"
