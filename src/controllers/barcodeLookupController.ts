import type { Request, Response } from "express";
import { HttpError } from "../utils/errors";
import * as lookupService from "../services/barcodeLookupService";

/* ==================== BARCODE LOOKUP CONTROLLERS ==================== */

// Lookup software purchase by serial number
export async function lookupSoftwareSerial(req: Request, res: Response) {
  try {
    const serial_number = req.params.serial_number;

    if (!serial_number || typeof serial_number !== 'string' || serial_number.trim() === '') {
      return res.status(400).json({ message: "Serial number is required." });
    }

    const result = await lookupService.lookupSoftwareBySerial(serial_number.trim());
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
    const serial_number = req.params.serial_number;

    if (!serial_number || typeof serial_number !== 'string' || serial_number.trim() === '') {
      return res.status(400).json({ message: "Serial number is required." });
    }

    const result = await lookupService.lookupCartridgeBySerial(serial_number.trim());
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
    const serial_number = req.params.serial_number;

    if (!serial_number || typeof serial_number !== 'string' || serial_number.trim() === '') {
      return res.status(400).json({ message: "Serial number is required." });
    }

    const trimmedSerial = serial_number.trim();

    // Try software first
    try {
      const result = await lookupService.lookupSoftwareBySerial(trimmedSerial);
      return res.status(200).json({ type: "software", ...result });
    } catch (softwareError) {
      // Only fallback to cartridge if it's a 404 (not found), not a server error
      if (softwareError instanceof HttpError && softwareError.status === 404) {
        try {
          const result = await lookupService.lookupCartridgeBySerial(trimmedSerial);
          return res.status(200).json({ type: "cartridge", ...result });
        } catch (cartridgeError) {
          // Both lookups failed with 404
          if (cartridgeError instanceof HttpError && cartridgeError.status === 404) {
            return res.status(404).json({ message: "Serial number not found in any system." });
          }
          // Cartridge lookup had a server error
          throw cartridgeError;
        }
      }
      // Software lookup had a server error (not 404)
      throw softwareError;
    }
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Universal lookup error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}
