import express from "express";
import prisma from "../lib/prisma.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();

router.get("/", authenticate, asyncHandler(async (req, res) => {
  const drivers = await prisma.driver.findMany({ orderBy: { id: "desc" } });
  return res.json(drivers);
}));

router.post("/", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { driverName, phoneNumber, passportNumber } = req.body || {};
  if (!driverName || !phoneNumber) {
    return res.status(400).json({ message: "Driver name and phone number are required" });
  }

  const created = await prisma.driver.create({ data: { driverName, phoneNumber, passportNumber: passportNumber || null } });
  return res.status(201).json(created);
}));

router.put("/:id", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { driverName, phoneNumber, passportNumber } = req.body || {};
  const updated = await prisma.driver.update({
    where: { id },
    data: { driverName, phoneNumber, passportNumber: passportNumber || null }
  });
  return res.json(updated);
}));

router.delete("/:id", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await prisma.driver.delete({ where: { id } });
  return res.status(204).send();
}));
export default router;



