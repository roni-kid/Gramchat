import dotenv from "dotenv";

dotenv.config();

const DEFAULT_CLIENT_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

export const getPort = () => process.env.PORT || "5001";

export const getClientOrigins = () => {
  const rawOrigins = process.env.CLIENT_URL || process.env.CORS_ORIGIN;

  if (!rawOrigins) return DEFAULT_CLIENT_ORIGINS;

  return rawOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

export const validateRequiredEnv = () => {
  const required = ["MONGODB_URI", "JWT_SECRET"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }
};
