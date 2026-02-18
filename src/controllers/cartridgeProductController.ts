import { Request, Response } from 'express';
import { HttpError } from '../utils/errors';
import * as productService from '../services/cartridgeProductService';
import * as categoryService from "../services/cartridgeCategoryService";
import { CartridgeBrandService } from "../services/cartridgeBrandService";
import { CartridgeProduct } from '../models/cartridgeModels';
import * as qrController from './cartridgeProductQrController';
import { validate as isUUID } from "uuid";


// export async function createProduct(req: Request, res: Response) {
//     try {

//         if(!req.body.brand_id || !req.body.category_id || !req.body.product_name || !req.body.model_number || req.body.unit_price === undefined) {
//             return res.status(400).json({ message: 'Missing required fields: brand_id, category_id, product_name, model_number, unit_price' });
//         }
//         if (!isUUID(req.body.brand_id)) {
//             return res.status(400).json({ message: "Invalid brand_id format. ID must be a valid UUID." });
//         }
//         if (!isUUID(req.body.category_id)) {
//             return res.status(400).json({ message: "Invalid category_id format. ID must be a valid UUID." });
//         }

//         if(!isUUID(req.user?.userId || '')) {
//             return res.status(400).json({ message: "Invalid user ID format. ID must be a valid UUID." });
//         }
        
//         const product: CartridgeProduct = await productService.createCartridgeProduct(req.body, req.user?.userId );
//         const qrData = await qrController.generateQrCode( product);

//         return res.status(201).json({ message: 'Product created successfully.', data: product , qrDetails: qrData });
//     } catch (err: any) {
//         if (err instanceof HttpError)
//             return res.status(err.status).json({ message: err.message });
//         console.error('Create product error:', err);
//         return res.status(500).json({ message: 'Server error.' });
//     }
// }

export async function createProduct(req: Request, res: Response) {
    try {
        const { brand_id, brand_name, category_id, category_name, product_name, model_number, unit_price } = req.body;

        // Validate required fields
        if (!brand_name || !category_name || !product_name || !model_number || unit_price === undefined) {
            return res.status(400).json({ message: 'Missing required fields: brand_name, category_name, product_name, model_number, unit_price' });
        }

        // Validate userId
        if (!isUUID(req.user?.userId || '')) {
            return res.status(400).json({ message: "Invalid user ID format. ID must be a valid UUID." });
        }

        let resolvedBrandId: string | undefined;
        let resolvedCategoryId: string | undefined;

        // -------- Resolve Brand --------
        if (brand_id) {
            if (!isUUID(brand_id)) {
                return res.status(400).json({
                    message: "Invalid brand_id format. ID must be a valid UUID."
                });
            }
            resolvedBrandId = brand_id;
        } else if (brand_name) {
            const brand = await CartridgeBrandService.getBrandByName(brand_name);
            if (!brand) {
                return res.status(404).json({
                    message: `Brand '${brand_name}' not found.`
                });
            }
            resolvedBrandId = brand.id;
        } else {
            return res.status(400).json({
                message: "Provide either brand_id or brand_name."
            });
        }

        // -------- Resolve Category --------
        if (category_id) {
            if (!isUUID(category_id)) {
                return res.status(400).json({
                    message: "Invalid category_id format. ID must be a valid UUID."
                });
            }
            resolvedCategoryId = category_id;
        } else if (category_name) {
            const category = await categoryService.getCategoryByName(category_name);
            if (!category) {
                return res.status(404).json({
                    message: `Category '${category_name}' not found.`
                });
            }
            resolvedCategoryId = category.id;
        } else {
            return res.status(400).json({
                message: "Provide either category_id or category_name."
            });
        }

        // Replace names with IDs for insertion
        const productPayload = {
            ...req.body,
            brand_id: resolvedBrandId,
            category_id: resolvedCategoryId
        };

        const product: CartridgeProduct = await productService.createCartridgeProduct(productPayload, req.user?.userId);

        // Generate QR pointing to product URL
        const qrData = await qrController.generateQrCode(product);

        return res.status(201).json({ message: 'Product created successfully.', data: product, qrDetails: qrData });

    } catch (err: any) {
        if (err instanceof HttpError) {
            return res.status(err.status).json({ message: err.message });
        }
        console.error('Create product error:', err);
        return res.status(500).json({ message: 'Server error.' });
    }
}

export async function getAllProducts(req: Request, res: Response) {
    try {
        const data = await productService.getAllCartridgeProducts();
        if (data.length === 0) {
            return res.status(200).json({ message: "No products found.", data: [] });
        }
        return res.status(200).json(data);
    } catch (err: any) {
        console.error('Get products error:', err);
        return res.status(500).json({ message: 'Server error.' });
    }
}

export async function getProductById(req: Request, res: Response) {
    try {
        if(!req.params.id) {
            return res.status(400).json({ message: 'Missing required parameter: id' });
        }
            if (!isUUID(req.params.id)) {
                return res.status(400).json({ message: "Invalid ID format. ID must be a valid UUID." });
            }
        const data = await productService.getCartridgeProductById(req.params.id as string);
        if (!data) {
            return res.status(404).json({ message: 'Product not found.' });
        }
        return res.status(200).json(data);
    } catch (err: any) {
        if (err instanceof HttpError)
            return res.status(err.status).json({ message: err.message });
        console.error('Get product error:', err);
        return res.status(500).json({ message: 'Server error.' });
    }
}

export async function getProductsByBrand(req: Request, res: Response) {
    try {
        const data = await productService.getCartridgeProductsByBrand(req.params.brandId as string);
        return res.status(200).json(data);
    } catch (err: any) {
        if (err instanceof HttpError)
            return res.status(err.status).json({ message: err.message });
        console.error('Get products by brand error:', err);
        return res.status(500).json({ message: 'Server error.' });
    }
}
export async function updateProduct(req: Request, res: Response) {
    try {
        const input = { id: req.params.id, ...req.body };
        if(!input.id) {
            return res.status(400).json({ message: 'Missing required parameter: id' });
        }
        if (!isUUID(input.id)) {
            return res.status(400).json({ message: "Invalid ID format. ID must be a valid UUID." });
        }

        const product: CartridgeProduct = await productService.updateCartridgeProduct(input);
        const qrData = await qrController.updateQrCode( product);
        return res.status(200).json({ message: 'Product updated successfully.', data: product, qrData });
    } catch (err: any) {
        if (err instanceof HttpError)
            return res.status(err.status).json({ message: err.message });
        console.error('Update product error:', err);
        return res.status(500).json({ message: 'Server error.' });
    }
}

export async function deleteProduct(req: Request, res: Response) {
    try {
        if (!req.params.id) {
            return res.status(400).json({ message: 'Missing required parameter: id' });
        }
            if (!isUUID(req.params.id)) {
                return res.status(400).json({ message: "Invalid ID format. ID must be a valid UUID." });
            }
        const data = await productService.deleteCartridgeProduct(req.params.id as string);
        return res.status(200).json({ message: 'Product deleted successfully.', data });
    } catch (err: any) {
        if (err instanceof HttpError)
            return res.status(err.status).json({ message: err.message });
        console.error('Delete product error:', err);
        return res.status(500).json({ message: 'Server error.' });
    }
}