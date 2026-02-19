import type { Request, Response } from "express";
import { HttpError } from "../utils/errors";
import * as lookupService from "../services/barcodeLookupService";

/* ==================== BARCODE LOOKUP CONTROLLERS ==================== */

// Lookup software purchase by serial number
export async function lookupSoftwareSerial(req: Request, res: Response) {
  try {
    const serial_number = String(req.params.serial_number);

    if (!serial_number) {
      return res.status(400).json({ message: "Serial number is required." });
    }

    const result = await lookupService.lookupSoftwareBySerial(serial_number);
    return res.status(200).json(result);
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Lookup software serial error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// Lookup cartridge purchase by serial number
export async function lookupCartridgeSerial(req: Request, res: Response) {
  try {
    const serial_number = String(req.params.serial_number);

    if (!serial_number) {
      return res.status(400).json({ message: "Serial number is required." });
    }

    const result = await lookupService.lookupCartridgeBySerial(serial_number);
    return res.status(200).json(result);
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Lookup cartridge serial error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// Universal lookup - tries both software and cartridge
export async function lookupSerial(req: Request, res: Response) {
  try {
    const serial_number = String(req.params.serial_number);

    if (!serial_number) {
      return res.status(400).json({ message: "Serial number is required." });
    }

    // Try software first
    try {
      const result = await lookupService.lookupSoftwareBySerial(serial_number);
      return res.status(200).json({ type: "software", ...result });
    } catch (softwareError) {
      // If not found in software, try cartridge
      try {
        const result = await lookupService.lookupCartridgeBySerial(serial_number);
        return res.status(200).json({ type: "cartridge", ...result });
      } catch (cartridgeError) {
        return res.status(404).json({ message: "Serial number not found in any system." });
      }
    }
  } catch (err: any) {
    console.error("Universal lookup error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}
