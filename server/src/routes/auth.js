import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "wadi-noor-fallback";

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  console.log(user);
  
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions
    },
    JWT_SECRET,
    { expiresIn: "12h" }
  );

  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions
    }
  });
});

router.get("/me", authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, role: true, permissions: true, createdAt: true }
  });

  return res.json(user);
});

router.post("/register", async (req, res) => {
  const { name, email, password, role, permissions } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required" });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ message: "Email already exists" });
  }

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

  const hashed = await bcrypt.hash(password, 10);
  const newUser = await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      role: role === "ADMIN" ? "ADMIN" : "STAFF",
      permissions: JSON.stringify(permissionsObj)
    },
    select: { id: true, name: true, email: true, role: true, permissions: true, createdAt: true }
  });

  return res.status(201).json(newUser);
});

export default router;


