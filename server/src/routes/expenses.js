import express from "express";
import prisma from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { hasPermission, getAmeerContext } from "../lib/permissions.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();
const allowedCategories = ["BUS", "ROOM", "MEAL", "TRAVEL", "GENERAL", "ADMINISTRATIVE", "MISCELLANEOUS", "OTHER"];
const categoryAliases = {
  Jadwal: "TRAVEL",
  Ameer: "GENERAL",
  Administrative: "ADMINISTRATIVE",
  Admin: "ADMINISTRATIVE",
  OTHER: "MISCELLANEOUS",
  Other: "MISCELLANEOUS"
};

const normalizeCategory = (value) => {
  if (!value) return value;
  return categoryAliases[value] || value;
};

router.get("/", authenticate, asyncHandler(async (req, res) => {
  if (!hasPermission(req.user, "can_view_expenses")) {
    return res.status(403).json({ message: "Access denied" });
  }

  const ameerId = getAmeerContext(req.user);
  const where = ameerId ? { trip: { ameerId, status: "OPEN" } } : {};

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      trip: { include: { package: true } },
      serviceProvider: true,
      createdBy: { select: { id: true, name: true, email: true } }
    }
  });

  return res.json(expenses);
}));

router.post("/", authenticate, asyncHandler(async (req, res) => {
  if (!hasPermission(req.user, "can_edit_expenses")) {
    return res.status(403).json({ message: "Access denied" });
  }

  const { date, category, amount, tripId, serviceProviderId } = req.body || {};
  const description = req.body?.description ?? "";
  if (!category || amount === undefined || amount === null || amount === "") {
    return res.status(400).json({ message: "Category and amount are required" });
  }

  const normalizedCategory = normalizeCategory(category);
  if (!allowedCategories.includes(normalizedCategory)) {
    return res.status(400).json({ message: "Invalid expense category" });
  }

  const ameerId = getAmeerContext(req.user);
  let selectedTrip = null;
  if (tripId) {
    selectedTrip = await prisma.trip.findUnique({
      where: { id: Number(tripId) },
      select: { id: true, tripDate: true, ameerId: true, status: true }
    });
    if (!selectedTrip) {
      return res.status(400).json({ message: "Trip not found" });
    }
  }
  if (!date && !selectedTrip) {
    return res.status(400).json({ message: "Date is required when no trip is selected" });
  }
  if (ameerId) {
    if (!tripId) {
      return res.status(400).json({ message: "Trip is required for staff expenses" });
    }
    if (!selectedTrip || selectedTrip.ameerId !== ameerId) {
      return res.status(403).json({ message: "You can only manage your assigned trips" });
    }
    if (selectedTrip.status !== "OPEN") {
      return res.status(403).json({ message: "You can only manage open trips" });
    }
  }
  if (serviceProviderId) {
    const provider = await prisma.serviceProvider.findUnique({ where: { id: Number(serviceProviderId) } });
    if (!provider) {
      return res.status(400).json({ message: "Service provider not found" });
    }
  }

  const created = await prisma.expense.create({
    data: {
      date: new Date(date || selectedTrip.tripDate),
      category: normalizedCategory,
      description,
      amount: Number(amount),
      tripId: tripId ? Number(tripId) : null,
      serviceProviderId: normalizedCategory === "BUS" && serviceProviderId ? Number(serviceProviderId) : null,
      createdById: req.user.id
    }
  });

  return res.status(201).json(created);
}));

router.put("/:id", authenticate, asyncHandler(async (req, res) => {
  if (!hasPermission(req.user, "can_edit_expenses")) {
    return res.status(403).json({ message: "Access denied" });
  }

  const id = Number(req.params.id);
  const existing = await prisma.expense.findUnique({ where: { id }, include: { trip: true } });
  if (!existing) {
    return res.status(404).json({ message: "Expense not found" });
  }

  if (req.user.role !== "ADMIN" && existing.createdById !== req.user.id) {
    return res.status(403).json({ message: "You can only edit expenses you created" });
  }

  const { date, category, description, amount, tripId, serviceProviderId } = req.body || {};
  const normalizedCategory = category ? normalizeCategory(category) : undefined;
  if (normalizedCategory && !allowedCategories.includes(normalizedCategory)) {
    return res.status(400).json({ message: "Invalid expense category" });
  }

  const ameerId = getAmeerContext(req.user);
  const targetTripId = tripId !== undefined ? (tripId ? Number(tripId) : null) : existing.tripId;
  let selectedTrip = null;
  if (targetTripId) {
    selectedTrip = await prisma.trip.findUnique({
      where: { id: Number(targetTripId) },
      select: { id: true, tripDate: true, ameerId: true, status: true }
    });
    if (!selectedTrip) {
      return res.status(400).json({ message: "Trip not found" });
    }
  }
  if (ameerId) {
    if (!targetTripId) {
      return res.status(403).json({ message: "Trip is required for staff expenses" });
    }
    if (!selectedTrip || selectedTrip.ameerId !== ameerId) {
      return res.status(403).json({ message: "You can only manage your assigned trips" });
    }
    if (selectedTrip.status !== "OPEN") {
      return res.status(403).json({ message: "You can only manage open trips" });
    }
  }
  if (serviceProviderId) {
    const provider = await prisma.serviceProvider.findUnique({ where: { id: Number(serviceProviderId) } });
    if (!provider) {
      return res.status(400).json({ message: "Service provider not found" });
    }
  }
  const nextCategory = normalizedCategory || existing.category;

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      date: date ? new Date(date) : tripId !== undefined && selectedTrip ? new Date(selectedTrip.tripDate) : undefined,
      category: normalizedCategory,
      description,
      amount: amount !== undefined ? Number(amount) : undefined,
      tripId: tripId !== undefined ? (tripId ? Number(tripId) : null) : undefined,
      serviceProviderId: nextCategory === "BUS"
        ? (serviceProviderId !== undefined ? (serviceProviderId ? Number(serviceProviderId) : null) : undefined)
        : null
    }
  });

  return res.json(updated);
}));

router.delete("/:id", authenticate, asyncHandler(async (req, res) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Admin access required" });
  }

  const id = Number(req.params.id);
  await prisma.expense.delete({ where: { id } });
  return res.status(204).send();
}));
export default router;







