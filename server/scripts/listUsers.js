import "dotenv/config";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: new URL("../prisma/.env", import.meta.url).pathname });

const prisma = new PrismaClient();

const users = await prisma.user.findMany({
  orderBy: { createdAt: "desc" },
  take: 20,
  select: { id: true, name: true, email: true, createdAt: true, permissions: true }
});

console.log(users);
await prisma.$disconnect();
