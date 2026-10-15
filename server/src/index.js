import dotenv from "dotenv";
import prisma from "./lib/prisma.js";
import app from "./app.js";

dotenv.config();

const PORT = process.env.PORT || 4000;

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log("Database connected");
  } catch (err) {
    console.error("Database connection failed:", err?.message || err);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`API running on port ${PORT}`);
  });
};

startServer();
