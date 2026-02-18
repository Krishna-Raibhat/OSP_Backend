import type { Request, Response } from "express";
import { HttpError } from "../utils/errors";
import * as activationService from "../services/activationService";

/* ==================== ACTIVATION CONTROLLERS ==================== */

// Verify serial number and phone, send activation key via email
export async function requestActivationKey(req: Request, res: Response) {
  try {
    const { phone, serial_number } = req.body;

    if (!phone || !serial_number) {
      return res.status(400).json({ 
        message: "Phone number and serial number are required." 
      });
    }

    const result = await activationService.verifyAndSendActivationKey({
      phone,
      serial_number,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error("Request activation key error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}
