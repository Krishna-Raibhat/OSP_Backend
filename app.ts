import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { testDbConnection } from "./src/config/db";
import authRoutes from "./src/routes/authRoutes";
import softwareBrandRoutes from "./src/routes/softwareBrandRoutes";
import softwareCategoryRoutes from "./src/routes/softwareCategoryRoutes";
import softwareProductRoutes from "./src/routes/softwareProductRoutes";
import softwarePlanRoutes from "./src/routes/softwarePlanRoutes";
import cartridgeBrandRoutes from "./src/routes/cartridgeBrandRoutes";
import cartridgeCategoryRoutes from "./src/routes/cartridgeCategoryRoutes";
import cartridgeProductQrRoutes from "./src/routes/cartridgeProductQrRoutes";
import softwareCustomerRoutes from "./src/routes/softwareCustomerRoutes";
import softwareCartRoutes from "./src/routes/softwareCartRoutes";
import softwareOrderRoutes from "./src/routes/softwareOrderRoutes";
import softwarePaymentRoutes from "./src/routes/softwarePaymentRoutes";
import cartridgeProductRoutes from "./src/routes/cartridgeProductRoutes";
import cartridgeCartRoutes from "./src/routes/cartridgeCartRoutes";
import cartridgeOrderRoutes from "./src/routes/cartridgeOrderRoutes";
import cartridgePaymentRoutes from "./src/routes/cartridgePaymentRoutes";
import barcodeLookupRoutes from "./src/routes/barcodeLookupRoutes";

dotenv.config();

const app = express();

// 🔐 Security middleware
app.use(helmet());

// 🌍 CORS configuration (Frontend runs on 3000)
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// 📦 Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 📄 Logger
app.use(morgan("dev"));

// 🔗 Routes
app.use("/api/auth", authRoutes);
app.use("/api/software/brands", softwareBrandRoutes);
app.use("/api/software/categories", softwareCategoryRoutes);
app.use("/api/software/products", softwareProductRoutes);
app.use("/api/software/plans", softwarePlanRoutes);
app.use("/api/cartridge/brands", cartridgeBrandRoutes);
app.use("/api/cartridge/categories", cartridgeCategoryRoutes);
app.use("/api/cartridge/products/qr", cartridgeProductQrRoutes);
app.use("/api/shop", softwareCustomerRoutes);
app.use("/api/cart", softwareCartRoutes);
app.use("/api/orders", softwareOrderRoutes);
app.use("/api/payments", softwarePaymentRoutes);
app.use("/api/cartridge/products", cartridgeProductRoutes);
app.use("/api/cartridge/cart", cartridgeCartRoutes);
app.use("/api/cartridge/orders", cartridgeOrderRoutes);
app.use("/api/cartridge/payments", cartridgePaymentRoutes);
app.use("/api/barcode", barcodeLookupRoutes);

// Special nested routes
import * as productController from "./src/controllers/softwareProductController";
import * as planController from "./src/controllers/softwarePlanController";
app.get(
  "/api/software/brands/:brandId/products",
  productController.getProductsByBrand,
);
app.get(
  "/api/software/products/:productId/plans",
  planController.getPlansByProduct,
);

// ❌ 404 handler
app.use((_req, res) => {
  res.status(404).json({
    message: "Route not found",
  });
});

// 🛑 Global error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("🔥 Error:", err);

  res.status(err.statusCode || 500).json({
    message: err.message || "Internal Server Error",
  });
});

const PORT = process.env.PORT || 3001;

// 🚀 Start server only after DB connects
async function startServer() {
  await testDbConnection();

  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  });
}

startServer();
