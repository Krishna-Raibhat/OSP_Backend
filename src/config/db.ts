import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined in .env");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Render Postgres
  },
});

// ✅ Database connection test
export async function testDbConnection() {
  try {
    const client = await pool.connect();
    console.log("✅ PostgreSQL database connected");
    client.release();
  } catch (error) {
    console.error("❌ Failed to connect to PostgreSQL", error);
    process.exit(1); // Stop app if DB is unreachable
  }
}
