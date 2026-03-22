import express from "express";
import prisma from "../lib/prisma.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { hasPermission } from "../lib/permissions.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();

router.get("/", authenticate, asyncHandler(async (req, res) => {
  if (!hasPermission(req.user, "can_view_packages")) {
    return res.status(403).json({ message: "Access denied" });
  }
  const packages = await prisma.package.findMany({ orderBy: { id: "desc" } });
  return res.json(packages);
}));

router.post("/", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { packageName, route, durationDays, departureDay, departureTime } = req.body || {};
  if (!packageName || !route || !durationDays || !departureDay || !departureTime) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const created = await prisma.package.create({
    data: {
      packageName,
      route,
      durationDays: Number(durationDays),
      departureDay,
      departureTime
    }
  });

  return res.status(201).json(created);
}));

router.put("/:id", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { packageName, route, durationDays, departureDay, departureTime } = req.body || {};

  const updated = await prisma.package.update({
    where: { id },
    data: {
      packageName,
      route,
      durationDays: Number(durationDays),
      departureDay,
      departureTime
    }
  });

  return res.json(updated);
}));

router.delete("/:id", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await prisma.package.delete({ where: { id } });
  return res.status(204).send();
}));
export default router;



