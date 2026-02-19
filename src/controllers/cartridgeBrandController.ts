import { Request, Response } from "express";
import { HttpError } from "../utils/errors";
import { CartridgeBrandService } from "../services/cartridgeBrandService";
import { uploadBrandImageToFolder } from "../utils/folderUpload";
import { validate as isUUID } from "uuid";

export const CartridgeBrandController = {
  async createCartridgeBrand(req: Request, res: Response) {
    try {
      const { name, is_active } = req.body;
      if (!name) throw new HttpError(400, "Brand name is required.");

      let img_url: string | undefined;

      // Image is required when creating brand
      if (!req.file) {
        return res.status(400).json({ message: "Brand image is required." });
      }

      const { originalPath } = await uploadBrandImageToFolder(req.file, name);
      img_url = originalPath;

      const brand = await CartridgeBrandService.createCartridgeBrand(
        name,
        img_url,
        is_active,
      );
      return res
        .status(201)
        .json({ message: "Brand created successfully.", brand });
    } catch (err: any) {
      if (err instanceof HttpError)
        return res.status(err.status).json({ message: err.message });
      console.error("Create brand error:", err);
      return res.status(500).json({ message: "Server error." });
    }
  },

  async getAllCartridgeBrands(req: Request, res: Response) {
    try {
      const brands = await CartridgeBrandService.getAllCartridgeBrands();
      return res.status(200).json({ brands });
    } catch (err: any) {
      console.error("Get brands error:", err);
      return res.status(500).json({ message: "Server error." });
    }
  },

  async getCartridgeBrandById(req: Request<{ id: string }>, res: Response) {
    try {
      const { id } = req.params;
      if (!id) {
        return res
          .status(400)
          .json({ message: "Missing required parameter: id" });
      }
      if (!isUUID(id)) {
        return res
          .status(400)
          .json({ message: "Invalid ID format. ID must be a valid UUID." });
      }
      const brand = await CartridgeBrandService.getCartridgeBrandById(id);
      if (!brand) throw new HttpError(404, "Brand not found.");
      return res.status(200).json({ brand });
    } catch (err: any) {
      if (err instanceof HttpError)
        return res.status(err.status).json({ message: err.message });
      console.error("Get brand by ID error:", err);
      return res.status(500).json({ message: "Server error." });
    }
  },

  async updateCartridgeBrand(req: Request<{ id: string }>, res: Response) {
    try {
      const { id } = req.params;
      if (!id) {
        return res
          .status(400)
          .json({ message: "Missing required parameter: id" });
      } else if (!isUUID(id)) {
        return res
          .status(400)
          .json({ message: "Invalid ID format. ID must be a valid UUID." });
      }
      const { name, is_active } = req.body;

      // Check if at least one field or image is provided
      if (!name && typeof is_active !== "boolean" && !req.file) {
        throw new HttpError(
          400,
          "At least one of name, is_active, or image must be provided.",
        );
      }

      // Get current brand to use existing name if needed
      const currentBrand =
        await CartridgeBrandService.getCartridgeBrandById(id);
      if (!currentBrand) throw new HttpError(404, "Brand not found.");

      let img_url: string | undefined;
      if (req.file) {
        try {
          const folderName = name || currentBrand.name; // Use new name if provided, otherwise use existing name
          const { originalPath } = await uploadBrandImageToFolder(
            req.file,
            folderName,
          );
          img_url = originalPath;
        } catch (err) {
          console.error("Image upload error:", err);
          throw new HttpError(500, "Failed to upload brand image.");
        }
      }

      const brand = await CartridgeBrandService.updateCartridgeBrand(id, {
        name,
        is_active,
        img_url,
      });
      if (!brand) throw new HttpError(404, "Brand not found.");

      return res
        .status(200)
        .json({ message: "Brand updated successfully.", brand });
    } catch (err: any) {
      if (err instanceof HttpError)
        return res.status(err.status).json({ message: err.message });
      console.error("Update brand error:", err);
      return res.status(500).json({ message: "Server error." });
    }
  },

  async deleteCartridgeBrand(req: Request<{ id: string }>, res: Response) {
    try {
      const { id } = req.params;
      if (!id) {
        return res
          .status(400)
          .json({ message: "Missing required parameter: id" });
      } else if (!isUUID(id)) {
        return res
          .status(400)
          .json({ message: "Invalid ID format. ID must be a valid UUID." });
      }
      await CartridgeBrandService.deleteCartridgeBrand(id);
      return res.status(200).json({ message: "Brand deleted successfully." });
    } catch (err: any) {
      if (err instanceof HttpError)
        return res.status(err.status).json({ message: err.message });
      console.error("Delete brand error:", err);
      return res.status(500).json({ message: "Server error." });
    }
  },
};
