import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";

import authRoutes from "./routes/auth.js";
import packageRoutes from "./routes/packages.js";
import tripRoutes from "./routes/trips.js";
import travelerRoutes from "./routes/travelers.js";
import expenseRoutes from "./routes/expenses.js";
import reportRoutes from "./routes/reports.js";
import userRoutes from "./routes/users.js";
import driverRoutes from "./routes/drivers.js";
import ameerRoutes from "./routes/ameers.js";
import providerRoutes from "./routes/providers.js";
import busRoutes from "./routes/buses.js";
import collectionRoutes from "./routes/collections.js";
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
app.use("/api/packages", packageRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/travelers", travelerRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/users", userRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/ameers", ameerRoutes);
app.use("/api/providers", providerRoutes);
app.use("/api/buses", busRoutes);
app.use("/api/collections", collectionRoutes);
app.use("/api/everluxe", everluxeRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

export default app;
