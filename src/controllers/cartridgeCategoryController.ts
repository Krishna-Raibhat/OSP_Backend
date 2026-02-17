import type { Request, Response } from "express";
import { HttpError } from "../utils/errors";
import * as categoryService from "../services/cartridgeCategoryService";
import { validate as isUUID } from "uuid";

export async function createCategory(req: Request, res: Response) {
  try {
    if (!req.body.name) {
      return res.status(400).json({ message: "Missing required field: name" });
    }
    const data = await categoryService.createCategory(req.body);
    return res
      .status(201)
      .json({ message: "Category created successfully.", data });
  } catch (err: any) {
    if (err instanceof HttpError)
      return res.status(err.status).json({ message: err.message });
    console.error("Create category error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function getAllCategories(req: Request, res: Response) {
  try {

    const data = await categoryService.getAllCategories();
    return res.status(200).json(data);
  } catch (err: any) {
    console.error("Get categories error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function getCategoryById(req: Request, res: Response) {
  try {
    if (!req.params.id) {
      return res.status(400).json({ message: "Missing required parameter: id" });
    }
    if (!isUUID(req.params.id)) {
      return res.status(400).json({ message: "Invalid ID format. ID must be a valid UUID." });
    }
    const data = await categoryService.getCategoryById(req.params.id as string);
    return res.status(200).json(data);
  } catch (err: any) {
    if (err instanceof HttpError)
      return res.status(err.status).json({ message: err.message });
    console.error("Get category error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function updateCategory(req: Request, res: Response) {
  try {
    const input = { id: req.params.id, ...req.body };
   

    if (!input.id) {
      return res.status(400).json({ message: "Missing required parameter: id" });
    } else if (!input.name && typeof input.is_active !== "boolean") {
      return res
        .status(400)
        .json({ message: "At least one field (name or is_active) is required for update." });
    }

     if (!isUUID(req.params.id)) {
      return res.status(400).json({ message: "Invalid ID format. ID must be a valid UUID." });
    }
    const data = await categoryService.updateCategory(input);
    return res
      .status(200)
      .json({ message: "Category updated successfully.", data });
  } catch (err: any) {
    if (err instanceof HttpError)
      return res.status(err.status).json({ message: err.message });
    console.error("Update category error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function deleteCategory(req: Request, res: Response) {
  try {
    if (!req.params.id) {
      return res.status(400).json({ message: "Missing required parameter: id" });
    }
      if (!isUUID(req.params.id)) { 
        return res.status(400).json({ message: "Invalid ID format. ID must be a valid UUID." });
      }
    const data = await categoryService.deleteCategory(req.params.id as string);
    return res.status(200).json(data);
  } catch (err: any) {
    if (err instanceof HttpError)
      return res.status(err.status).json({ message: err.message });
    console.error("Delete category error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}
