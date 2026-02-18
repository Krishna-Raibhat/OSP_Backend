import bwipjs from "bwip-js";

/**
 * Generate barcode image as base64 data URL from serial number
 * @param serialNumber - The serial number to encode
 * @returns Base64 data URL of the barcode image
 */
export async function generateBarcodeImage(serialNumber: string): Promise<string> {
  try {
    // Generate Code128 barcode (supports alphanumeric)
    const png = await bwipjs.toBuffer({
      bcid: "code128",       // Barcode type
      text: serialNumber,    // Text to encode
      scale: 3,              // 3x scaling factor
      height: 10,            // Bar height, in millimeters
      includetext: true,     // Show human-readable text
      textxalign: "center",  // Center the text
    });

    // Convert to base64 data URL
    const base64 = png.toString("base64");
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error("Barcode generation error:", error);
    throw new Error("Failed to generate barcode");
  }
}
