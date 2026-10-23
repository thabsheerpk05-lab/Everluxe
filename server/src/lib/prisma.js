// Load the server environment before constructing PrismaClient. ESM imports are
// evaluated before index.js reaches dotenv.config(), so loading it here avoids
// a startup crash with DATABASE_URL reported as missing.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default prisma;
