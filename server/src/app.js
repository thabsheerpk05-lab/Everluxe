import express from "express";
import cors from "cors";
import morgan from "morgan";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import everluxeRoutes from "./routes/everluxe.js";
import prisma from "./lib/prisma.js";
import { asyncHandler } from "./utils/asyncHandler.js";
import { logApiError } from "./utils/errorHandling.js";
import { LOCAL_UPLOADS_DIR } from "./lib/everluxe.js";

const app = express();
const configuredOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);
const vercelOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
const allowedOrigins = new Set([...configuredOrigins, vercelOrigin].filter(Boolean));
const isVercelOrigin = (origin) => origin === "https://everluxe-indol.vercel.app";
const isLocalOrigin = (origin) => origin === "http://localhost:5173" || origin === "http://127.0.0.1:5173" || origin === "http://localhost:5174" || origin === "http://127.0.0.1:5174";

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin) || isVercelOrigin(origin) || isLocalOrigin(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true
  })
);
app.use(express.json({ limit: "12mb" }));
app.use(morgan("dev"));
app.use("/uploads", express.static(process.env.UPLOADS_DIR || LOCAL_UPLOADS_DIR));

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

app.use((err, req, res, _next) => {
  const details = logApiError(err, req);
  res.status(details.status).json({
    message: details.message,
    errorType: details.category
  });
});

export default app;
