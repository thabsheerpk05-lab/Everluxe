import express from "express";
import prisma from "../lib/prisma.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authenticate, requireAdmin, async (req, res) => {
  const buses = await prisma.bus.findMany({
    orderBy: { busName: "asc" }
  });
  return res.json(buses);
});

router.post("/", authenticate, requireAdmin, async (req, res) => {
  const { busName, busNumber } = req.body || {};
  if (!busName || !busNumber) {
    return res.status(400).json({ message: "Bus name and number are required" });
  }

  const existing = await prisma.bus.findFirst({ where: { busNumber } });
  if (existing) {
    return res.status(409).json({ message: "Bus number already exists" });
  }

  const created = await prisma.bus.create({
    data: {
      busName,
      busNumber
    }
  });

  return res.status(201).json(created);
});

router.put("/:id", authenticate, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { busName, busNumber } = req.body || {};
  if (!busName || !busNumber) {
    return res.status(400).json({ message: "Bus name and number are required" });
  }

  const existing = await prisma.bus.findFirst({
    where: {
      busNumber,
      NOT: { id }
    }
  });
  if (existing) {
    return res.status(409).json({ message: "Bus number already exists" });
  }

  const updated = await prisma.bus.update({
    where: { id },
    data: {
      busName,
      busNumber
    }
  });

  return res.json(updated);
});

router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await prisma.bus.delete({ where: { id } });
  return res.status(204).send();
});

export default router;
