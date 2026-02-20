import type { Request, Response } from "express";
import { HttpError } from "../utils/errors";
import * as qrService from "../services/cartridgeProductQrService";
import { CartridgeProduct } from "../models/cartridgeModels";
import QRCode from "qrcode";
import * as saveImg from "../utils/folderUpload"

export async function generateQrCode(product: CartridgeProduct) {
  try {
    const productId = product.id;
    if (!productId) {
      throw new HttpError(400, "Product ID is required to generate QR code.");
    }
    const scanUrl = `${process.env.BASE_URL}/services?productId=${productId}`;
    const qrBuffer = await QRCode.toBuffer(scanUrl, { type: "png" ,width: 300,});

    const multerFile: Express.Multer.File = {
      fieldname: "qrCode",
      buffer: qrBuffer,
      originalname: `product_${productId}_qr.png`,} as Express.Multer.File;

    const { originalPath } = await saveImg.uploadProductQRToFolder(multerFile, productId);

    const data = await qrService.generateProductQR(product.id, originalPath);
    return data;
  } catch (err: any) {
    return err;
  }
}

export async function getQrCodeByProductId(req: Request, res: Response) {
  try {
    const productId = req.params.productId as string;
    const data = await qrService.getProductQRByProductId(productId);
    return res.status(200).json(data);
  } catch (err: any) {
    if (err instanceof HttpError)
      return res.status(err.status).json({ message: err.message });
    console.error("Get QR code error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function deactivateQrCode(req: Request, res: Response) {
  try {
    const productId = req.params.productId as string;
    await qrService.deactivateProductQR(productId);
    return res
      .status(200)
      .json({ message: "QR code deactivated successfully." });
  } catch (err: any) {
    if (err instanceof HttpError)
      return res.status(err.status).json({ message: err.message });
    console.error("Deactivate QR code error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function reactivateQrCode(req: Request, res: Response) {
  try {

    
    const productId = req.params.productId as string;

    await qrService.reactivateProductQR(productId);
    return res
      .status(200)
      .json({ message: "QR code reactivated successfully." });
  } catch (err: any) {
    if (err instanceof HttpError)
      return res.status(err.status).json({ message: err.message });
    console.error("Reactivate QR code error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function deleteQrCode(req: Request, res: Response) {
  try {
    const productId = req.params.productId as string;
    await qrService.deleteProductQR(productId);
    return res.status(200).json({ message: "QR code deleted successfully." });
  } catch (err: any) {
    if (err instanceof HttpError)
      return res.status(err.status).json({ message: err.message });
    console.error("Delete QR code error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function getAllQrCodes(req: Request, res: Response) {
  try {
    const data = await qrService.getAllProductQRs();
    return res.status(200).json(data);
  } catch (err: any) {
    console.error("Get all QR codes error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// export async function updateQrCode(product: CartridgeProduct) {
//   try {
//     const data = await qrService.updateProductQR(product);
//     return data;
//   } catch (err: any) {
//     return err;
//   }
// }

export async function getQrImage(req: Request, res: Response) {
  try {
    const productId = req.params.productId as string;
    
    if (!productId) {
      return res.status(400).json({ message: "Product ID is required." });
    }

    // Get QR code data from database
    const qrData = await qrService.getProductQRByProductId(productId);
    
    if (!qrData || !qrData.qr_value) {
      return res.status(404).json({ message: "QR code not found for this product." });
    }

    // Construct full file path
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, '../../../', qrData.qr_value);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "QR code image file not found." });
    }

    // Set CORS headers for cross-origin access
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

    // Set content type
    res.setHeader("Content-Type", "image/png");

    // Set cache headers (cache for 1 year)
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    // Send the file
    return res.sendFile(filePath);
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error("Get QR image error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}
