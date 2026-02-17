import type { Request, Response } from "express";
import { HttpError } from "../utils/errors";
import * as categoryService from "../services/softwareCategoryService";

export async function createCategory(req: Request, res: Response) {
  try {
    const data = await categoryService.createCategory(req.body);
    return res.status(201).json({ message: "Category created successfully.", data });
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
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
    const id = String(req.params.id);
    const data = await categoryService.getCategoryById(id);
    return res.status(200).json(data);
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Get category error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function updateCategory(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const data = await categoryService.updateCategory({ id, ...req.body });
    return res.status(200).json({ message: "Category updated successfully.", data });
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Update category error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function deleteCategory(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const data = await categoryService.deleteCategory(id);
    return res.status(200).json(data);
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Delete category error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}
