import type { Request, Response } from "express";
import { HttpError } from "../utils/errors";
import * as planService from "../services/softwarePlanService";

export async function createPlan(req: Request, res: Response) {
  try {
    const data = await planService.createPlan(req.body);
    return res.status(201).json({ message: "Plan created successfully.", data });
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Create plan error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function getAllPlans(req: Request, res: Response) {
  try {
    const data = await planService.getAllPlans();
    return res.status(200).json(data);
  } catch (err: any) {
    console.error("Get plans error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function getPlanById(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const data = await planService.getPlanById(id);
    return res.status(200).json(data);
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Get plan error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function getPlansByProduct(req: Request, res: Response) {
  try {
    const productId = String(req.params.productId);
    const data = await planService.getPlansByProduct(productId);
    return res.status(200).json(data);
  } catch (err: any) {
    console.error("Get plans by product error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function updatePlan(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const data = await planService.updatePlan({ id, ...req.body });
    return res.status(200).json({ message: "Plan updated successfully.", data });
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Update plan error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function deletePlan(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const data = await planService.deletePlan(id);
    return res.status(200).json(data);
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    console.error("Delete plan error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}
