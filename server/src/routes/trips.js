import express from "express";
import prisma from "../lib/prisma.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { hasPermission, getAmeerContext } from "../lib/permissions.js";

const router = express.Router();
const allowedStatuses = ["OPEN", "FINISHED"];

router.get("/", authenticate, async (req, res) => {
  if (!hasPermission(req.user, "can_view_trips")) {
    return res.status(403).json({ message: "Access denied" });
  }

  const ameerId = getAmeerContext(req.user);
  const where = ameerId ? { ameerId, status: "OPEN" } : {};

  const trips = await prisma.trip.findMany({
    where,
    orderBy: { tripDate: "desc" },
    include: {
      package: true,
      driver: true,
      coDriver: true,
      ameer: true,
      bus: true,
      _count: { select: { travelers: true } }
    }
  });

  return res.json(trips);
});

router.post("/", authenticate, requireAdmin, async (req, res) => {
  const { packageId, tripDate, seasonalPrice, notes, driverId, coDriverId, ameerId, busId } = req.body || {};
  if (!packageId || !tripDate || !seasonalPrice || !driverId || !ameerId || !busId) {
    return res.status(400).json({ message: "Package, trip date, price, driver, ameer, and bus are required" });
  }

  const created = await prisma.trip.create({
    data: {
      packageId: Number(packageId),
      tripDate: new Date(tripDate),
      seasonalPrice: Number(seasonalPrice),
      notes: notes || null,
      driverId: Number(driverId),
      coDriverId: coDriverId ? Number(coDriverId) : null,
      ameerId: Number(ameerId),
      busId: Number(busId),
      createdById: req.user.id
    },
    include: { package: true, driver: true, coDriver: true, ameer: true, bus: true }
  });

  return res.status(201).json(created);
});

router.put("/:id", authenticate, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { packageId, tripDate, seasonalPrice, notes, driverId, coDriverId, ameerId, busId, status } = req.body || {};
  if (!packageId || !tripDate || !seasonalPrice || !driverId || !ameerId || !busId) {
    return res.status(400).json({ message: "Package, trip date, price, driver, ameer, and bus are required" });
  }
  if (status && !allowedStatuses.includes(status)) {
    return res.status(400).json({ message: "Invalid trip status" });
  }

  const updated = await prisma.trip.update({
    where: { id },
    data: {
      packageId: Number(packageId),
      tripDate: new Date(tripDate),
      seasonalPrice: Number(seasonalPrice),
      notes: notes || null,
      driverId: Number(driverId),
      coDriverId: coDriverId ? Number(coDriverId) : null,
      ameerId: Number(ameerId),
      busId: Number(busId),
      status: status || undefined
    },
    include: { package: true, driver: true, coDriver: true, ameer: true, bus: true }
  });

  return res.json(updated);
});

router.put("/:id/status", authenticate, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ message: "Invalid trip status" });
  }

  const updated = await prisma.trip.update({
    where: { id },
    data: { status },
    include: {
      package: true,
      driver: true,
      coDriver: true,
      ameer: true,
      bus: true,
      _count: { select: { travelers: true } }
    }
  });

  return res.json(updated);
});

router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await prisma.trip.delete({ where: { id } });
  return res.status(204).send();
});

export default router;







