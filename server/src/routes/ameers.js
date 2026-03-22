import express from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();
const ameerPermissionsBase = {
  can_view_trips: true,
  can_view_packages: true,
  can_view_travelers: true,
  can_edit_travelers: true,
  can_view_expenses: true,
  can_edit_expenses: true,
  can_view_reports: true,
  can_manage_payments: true,
  is_ameer: true
};

router.get("/", authenticate, asyncHandler(async (req, res) => {
  const ameers = await prisma.ameer.findMany({ orderBy: { id: "desc" } });
  return res.json(ameers);
}));

router.post("/", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { name, phone, notes, passportNumber, email, password } = req.body || {};
  if (!name || !phone) {
    return res.status(400).json({ message: "Ameer name and phone are required" });
  }
  const providedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (providedEmail) {
    const existing = await prisma.user.findUnique({ where: { email: providedEmail } });
    if (existing) {
      return res.status(400).json({ message: "Email already exists." });
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    const ameer = await tx.ameer.create({
      data: { name, phone, notes: notes || null, passportNumber: passportNumber || null }
    });

    const digits = String(phone).replace(/\D/g, "");
    let userEmail = providedEmail;
    if (!userEmail) {
      const base = digits ? `ameer${digits}` : `ameer${ameer.id}`;
      userEmail = `${base}@wadi-noor.com`;
      let suffix = 1;
      while (await tx.user.findUnique({ where: { email: userEmail } })) {
        userEmail = `${base}+${suffix}@wadi-noor.com`;
        suffix += 1;
      }
    }

    const providedPassword = typeof password === "string" ? password.trim() : "";
    const rawPassword = providedPassword || digits || "ameer123";
    const hashed = await bcrypt.hash(rawPassword, 10);
    const permissions = { ...ameerPermissionsBase, ameer_id: ameer.id };

    await tx.user.create({
      data: {
        name: ameer.name,
        email: userEmail,
        password: hashed,
        role: "STAFF",
        permissions: JSON.stringify(permissions)
      }
    });

    return ameer;
  });

  return res.status(201).json(created);
}));

router.put("/:id", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { name, phone, notes, passportNumber, email, password } = req.body || {};
  const updated = await prisma.ameer.update({
    where: { id },
    data: { name, phone, notes: notes || null, passportNumber: passportNumber || null }
  });
  return res.json(updated);
}));

router.delete("/:id", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await prisma.ameer.delete({ where: { id } });
  return res.status(204).send();
}));
export default router;






