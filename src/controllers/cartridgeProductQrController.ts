import type { Request, Response } from "express";
import { HttpError } from "../utils/errors";
import * as qrService from "../services/cartridgeProductQrService";
import { CartridgeProduct } from "../models/cartridgeModels";


export async function generateQrCode(res: Response, product: CartridgeProduct) {
  try {
    const data = await qrService.generateProductQR(product);
    return res
      .status(201)
      .json({ message: "QR code generated successfully.", data });
  } catch (err: any) {
    if (err instanceof HttpError)
      return res.status(err.status).json({ message: err.message });
    console.error("Generate QR code error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function getQrCodeByProductId(req: Request, res: Response) {
  try {
    const productId = parseInt(req.params.productId as string, 10);
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
    const productId = parseInt(req.params.productId as string, 10);
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
    const productId = parseInt(req.params.productId as string, 10);
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
    const productId = parseInt(req.params.productId as string, 10);
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

export async function updateQrCode(res: Response, product: CartridgeProduct) {
  try {
    const data = await qrService.updateProductQR(product);
    return res
      .status(200)
      .json({ message: "QR code updated successfully.", data });
  } catch (err: any) {
    if (err instanceof HttpError)
      return res.status(err.status).json({ message: err.message });
    console.error("Update QR code error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}
