import { Request, Response } from 'express';
import { HttpError } from '../utils/errors';
import * as productService from '../services/cartridgeProductService';
import { CartridgeProduct } from '../models/cartridgeModels';
import * as qrController from './cartridgeProductQrController';

export async function createProduct(req: Request, res: Response) {
    try {
        const product: CartridgeProduct = await productService.createCartridgeProduct(req.body, req.user?.userId );
        await qrController.generateQrCode(res, product);

        return res.status(201).json({ message: 'Product created successfully.', data: product });
    } catch (err: any) {
        if (err instanceof HttpError)
            return res.status(err.status).json({ message: err.message });
        console.error('Create product error:', err);
        return res.status(500).json({ message: 'Server error.' });
    }
}

export async function getAllProducts(req: Request, res: Response) {
    try {
        const data = await productService.getAllCartridgeProducts();
        return res.status(200).json(data);
    } catch (err: any) {
        console.error('Get products error:', err);
        return res.status(500).json({ message: 'Server error.' });
    }
}

export async function getProductById(req: Request, res: Response) {
    try {
        const data = await productService.getCartridgeProductById(req.params.id as string);
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
        const product: CartridgeProduct = await productService.updateCartridgeProduct(input);
       // await qrService.updateProductQR(product);
        return res.status(200).json({ message: 'Product updated successfully.', data: product });
    } catch (err: any) {
        if (err instanceof HttpError)
            return res.status(err.status).json({ message: err.message });
        console.error('Update product error:', err);
        return res.status(500).json({ message: 'Server error.' });
    }
}

export async function deleteProduct(req: Request, res: Response) {
    try {
        const data = await productService.deleteCartridgeProduct(req.params.id as string);
        return res.status(200).json({ message: 'Product deleted successfully.', data });
    } catch (err: any) {
        if (err instanceof HttpError)
            return res.status(err.status).json({ message: err.message });
        console.error('Delete product error:', err);
        return res.status(500).json({ message: 'Server error.' });
    }
}