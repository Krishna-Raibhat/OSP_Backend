import { pool } from "../config/db";
import { HttpError } from "../utils/errors";
import { getS3Url } from "../utils/s3Upload";
import type { SoftwareBrand, SoftwareProduct, SoftwarePlan } from "../models/softwareModels";

/* ==================== CUSTOMER FACING SERVICES ==================== */

// Get all active brands for customers
export async function getActiveBrands() {
  const q = `SELECT id, name, thumbnail_url, original_url FROM software_brands WHERE is_active = true ORDER BY name ASC;`;
  const result = await pool.query<SoftwareBrand>(q);
  
  // Add full S3 URLs
  return result.rows.map(brand => ({
    ...brand,
    thumbnail_url: brand.thumbnail_url ? getS3Url(brand.thumbnail_url) : null,
    original_url: brand.original_url ? getS3Url(brand.original_url) : null,
  }));
}

// Get all active categories for customers
export async function getActiveCategories() {
  const q = `SELECT * FROM software_categories WHERE is_active = true ORDER BY name ASC;`;
  const result = await pool.query(q);
  return result.rows;
}

// Get products by brand with pricing info
export async function getProductsByBrandForCustomer(brand_id: string, userRole?: string) {
  const q = `
    SELECT 
      p.id,
      p.brand_id,
      p.category_id,
      p.name,
      p.description,
      b.name as brand_name,
      b.thumbnail_url as brand_thumbnail_url,
      b.original_url as brand_original_url,
      c.name as category_name
    FROM software_products p
    JOIN software_brands b ON p.brand_id = b.id
    JOIN software_categories c ON p.category_id = c.id
    WHERE p.brand_id = $1 AND p.is_active = true
    ORDER BY p.name ASC;
  `;
  
  const result = await pool.query(q, [brand_id]);
  const products = result.rows;

  // Get plans for each product with role-based pricing
  const productsWithPlans = await Promise.all(
    products.map(async (product) => {
      const plans = await getPlansByProductForCustomer(product.id, userRole);
      return {
        ...product,
        brand_thumbnail_url: product.brand_thumbnail_url ? getS3Url(product.brand_thumbnail_url) : null,
        brand_original_url: product.brand_original_url ? getS3Url(product.brand_original_url) : null,
        plans,
      };
    })
  );

  return productsWithPlans;
}

// Get plans by product with role-based pricing
export async function getPlansByProductForCustomer(product_id: string, userRole?: string) {
  const q = `
    SELECT 
      id,
      software_product_id,
      plan_name,
      duration_type,
      price,
      special_price,
      features
    FROM software_plans
    WHERE software_product_id = $1 AND is_active = true
    ORDER BY price ASC;
  `;
  
  const result = await pool.query<SoftwarePlan>(q, [product_id]);
  
  // Transform plans based on user role
  return result.rows.map((plan) => {
    const isDistributor = userRole === "distributor";
    
    // Determine display price
    let displayPrice = plan.price;
    let hasDiscount = false;
    
    if (isDistributor && plan.special_price !== null) {
      // Distributor sees special price if available
      displayPrice = plan.special_price;
      hasDiscount = true;
    }
    // Normal user always sees regular price (no special price shown)
    
    return {
      id: plan.id,
      plan_name: plan.plan_name,
      duration_type: plan.duration_type,
      price: displayPrice,
      original_price: hasDiscount ? plan.price : null,
      features: plan.features,
      has_discount: hasDiscount,
    };
  });
}

// Get single plan details for checkout
export async function getPlanForCheckout(plan_id: string, userRole?: string) {
  const q = `
    SELECT 
      pl.id,
      pl.software_product_id,
      pl.plan_name,
      pl.duration_type,
      pl.price,
      pl.special_price,
      pl.features,
      p.name as product_name,
      p.description as product_description,
      b.name as brand_name,
      c.name as category_name
    FROM software_plans pl
    JOIN software_products p ON pl.software_product_id = p.id
    JOIN software_brands b ON p.brand_id = b.id
    JOIN software_categories c ON p.category_id = c.id
    WHERE pl.id = $1 AND pl.is_active = true;
  `;
  
  const result = await pool.query(q, [plan_id]);
  const plan = result.rows[0];
  
  if (!plan) throw new HttpError(404, "Plan not found.");
  
  const isDistributor = userRole === "distributor";
  
  // Determine final price
  let finalPrice = plan.price;
  let hasDiscount = false;
  
  if (isDistributor && plan.special_price !== null) {
    // Distributor gets special price if available
    finalPrice = plan.special_price;
    hasDiscount = true;
  }
  // Normal user always sees regular price
  
  return {
    id: plan.id,
    plan_name: plan.plan_name,
    duration_type: plan.duration_type,
    price: finalPrice,
    original_price: hasDiscount ? plan.price : null,
    features: plan.features,
    has_discount: hasDiscount,
    product_name: plan.product_name,
    product_description: plan.product_description,
    brand_name: plan.brand_name,
    category_name: plan.category_name,
    user_type: isDistributor ? "distributor" : "customer",
  };
}

// Get all products with plans (for browsing all)
export async function getAllProductsForCustomer(userRole?: string) {
  const q = `
    SELECT 
      p.id,
      p.brand_id,
      p.category_id,
      p.name,
      p.description,
      b.name as brand_name,
      b.thumbnail_url as brand_thumbnail_url,
      b.original_url as brand_original_url,
      c.name as category_name
    FROM software_products p
    JOIN software_brands b ON p.brand_id = b.id
    JOIN software_categories c ON p.category_id = c.id
    WHERE p.is_active = true
    ORDER BY b.name ASC, p.name ASC;
  `;
  
  const result = await pool.query(q);
  const products = result.rows;

  const productsWithPlans = await Promise.all(
    products.map(async (product) => {
      const plans = await getPlansByProductForCustomer(product.id, userRole);
      return {
        ...product,
        brand_thumbnail_url: product.brand_thumbnail_url ? getS3Url(product.brand_thumbnail_url) : null,
        brand_original_url: product.brand_original_url ? getS3Url(product.brand_original_url) : null,
        plans,
      };
    })
  );

  return productsWithPlans;
}
