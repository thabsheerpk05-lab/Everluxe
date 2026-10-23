import dotenv from "dotenv";
import prisma from "./lib/prisma.js";
import app from "./app.js";

dotenv.config();

const PORT = process.env.PORT || 4000;

const startServer = async () => {
  // Keep the HTTP API available during local database outages so the client
  // receives a truthful 503 response instead of a browser-level fetch error.
  app.listen(PORT, () => {
    console.log(`API running on port ${PORT}`);
  });
  try {
    await prisma.$connect();
    console.log("Database connected");
  } catch (err) {
    console.error("Database connection failed:", err?.message || err);
    return;
  }
};

startServer();
