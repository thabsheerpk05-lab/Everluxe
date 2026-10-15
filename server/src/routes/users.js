import express from "express";
import prisma from "../lib/prisma.js";
import bcrypt from "bcryptjs";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();

router.get("/", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, role: true, permissions: true, createdAt: true }
  });

  return res.json(users);
}));

router.put("/:id", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { name, email, role, password } = req.body || {};
  if (role && !["ADMIN", "CUSTOMER"].includes(role)) return res.status(400).json({ message: "Users can only be ADMIN or CUSTOMER." });

  const data = {
    name,
    email,
    role: role || "CUSTOMER",
    permissions: "{}"
  };

  if (password) {
    data.password = await bcrypt.hash(password, 10);
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, permissions: true, createdAt: true }
  });

  return res.json(updated);
}));

router.delete("/:id", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) {
    return res.status(400).json({ message: "You cannot delete your own account" });
  }

  await prisma.user.delete({ where: { id } });
  return res.status(204).send();
}));
export default router;





