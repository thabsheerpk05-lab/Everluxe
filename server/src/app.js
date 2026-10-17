import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import everluxeRoutes from "./routes/everluxe.js";
import prisma from "./lib/prisma.js";
import { asyncHandler } from "./utils/asyncHandler.js";

const app = express();
const configuredOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);
const vercelOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
const allowedOrigins = new Set([...configuredOrigins, vercelOrigin].filter(Boolean));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true
  })
);
app.use(express.json({ limit: "12mb" }));
app.use(morgan("dev"));
app.use("/uploads", express.static(process.env.UPLOADS_DIR || path.resolve(process.cwd(), "uploads")));

app.get("/", (_req, res) => {
  res.json({ status: "Everluxe Events API running" });
});
app.get("/api/health", asyncHandler(async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok" });
}));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/everluxe", everluxeRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

export default app;
