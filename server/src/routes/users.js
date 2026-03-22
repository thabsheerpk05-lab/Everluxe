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
  const { name, email, role, password, permissions } = req.body || {};

  const staffBase = {
    can_view_trips: true,
    can_view_packages: true,
    can_view_travelers: true,
    can_edit_travelers: true,
    can_view_expenses: true,
    can_edit_expenses: true,
    can_view_reports: true,
    can_manage_payments: true
  };
  let permissionsObj = typeof permissions === "string" ? JSON.parse(permissions) : (permissions || {});
  const isAdmin = role === "ADMIN";
  if (!isAdmin) {
    if (!permissionsObj.is_ameer || !permissionsObj.ameer_id) {
      return res.status(400).json({ message: "Staff users must be assigned to an ameer." });
    }
    permissionsObj = { ...staffBase, ...permissionsObj, is_ameer: true };
  } else {
    permissionsObj = { ...permissionsObj, is_ameer: false };
    delete permissionsObj.ameer_id;
  }

  const data = {
    name,
    email,
    role: role === "ADMIN" ? "ADMIN" : "STAFF",
    permissions: JSON.stringify(permissionsObj)
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





