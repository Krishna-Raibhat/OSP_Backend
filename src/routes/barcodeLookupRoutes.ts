import { Router } from "express";
import * as lookupController from "../controllers/barcodeLookupController";

const router = Router();

// Public routes - no authentication required for barcode scanning
router.get("/software/:serial_number", lookupController.lookupSoftwareSerial);
router.get("/cartridge/:serial_number", lookupController.lookupCartridgeSerial);
router.get("/lookup/:serial_number", lookupController.lookupSerial);

export default router;
