import { Request, Response } from "express";
import { HttpError } from "../utils/errors";
import { CartridgeBrandService } from "../services/cartridgeBrandService";

export const CartridgeBrandController = {
  async createCartridgeBrand(req: Request, res: Response) {
    try {
      const { name } = req.body;
      if (!name) throw new HttpError(400, "Brand name is required.");

      const brand = await CartridgeBrandService.createCartridgeBrand(name);
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
      const { name, is_active } = req.body;
      if (!name && typeof is_active !== "boolean") {
        throw new HttpError(400, "name or is_active is required.");
      }

      const brand = await CartridgeBrandService.updateCartridgeBrand(id, {
        name,
        is_active,
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
