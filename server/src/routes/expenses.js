import express from "express";
import prisma from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { hasPermission, getAmeerContext } from "../lib/permissions.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();
const allowedCategories = ["BUS", "ROOM", "MEAL", "TRAVEL", "GENERAL", "OTHER"];

router.get("/", authenticate, asyncHandler(async (req, res) => {
  if (!hasPermission(req.user, "can_view_expenses")) {
    return res.status(403).json({ message: "Access denied" });
  }

  const ameerId = getAmeerContext(req.user);
  const where = ameerId ? { trip: { ameerId, status: "OPEN" } } : {};

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { date: "desc" },
    include: { createdBy: { select: { id: true, name: true, email: true } } }
  });

  return res.json(expenses);
}));

router.post("/", authenticate, asyncHandler(async (req, res) => {
  if (!hasPermission(req.user, "can_edit_expenses")) {
    return res.status(403).json({ message: "Access denied" });
  }

  const { date, category, amount, tripId } = req.body || {};
  const description = req.body?.description ?? "";
  if (!date || !category || amount === undefined || amount === null || amount === "") {
    return res.status(400).json({ message: "Date, category, and amount are required" });
  }

  if (!allowedCategories.includes(category)) {
    return res.status(400).json({ message: "Invalid expense category" });
  }

  const ameerId = getAmeerContext(req.user);
  if (ameerId) {
    if (!tripId) {
      return res.status(400).json({ message: "Trip is required for staff expenses" });
    }
    const trip = await prisma.trip.findUnique({
      where: { id: Number(tripId) },
      select: { ameerId: true, status: true }
    });
    if (!trip || trip.ameerId !== ameerId) {
      return res.status(403).json({ message: "You can only manage your assigned trips" });
    }
    if (trip.status !== "OPEN") {
      return res.status(403).json({ message: "You can only manage open trips" });
    }
  }

  const created = await prisma.expense.create({
    data: {
      date: new Date(date),
      category,
      description,
      amount: Number(amount),
      tripId: tripId ? Number(tripId) : null,
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

  const { date, category, description, amount, tripId } = req.body || {};
  if (category && !allowedCategories.includes(category)) {
    return res.status(400).json({ message: "Invalid expense category" });
  }

  const ameerId = getAmeerContext(req.user);
  if (ameerId) {
    const targetTripId = tripId !== undefined ? (tripId ? Number(tripId) : null) : existing.tripId;
    if (!targetTripId) {
      return res.status(403).json({ message: "Trip is required for staff expenses" });
    }
    const trip = await prisma.trip.findUnique({
      where: { id: Number(targetTripId) },
      select: { ameerId: true, status: true }
    });
    if (!trip || trip.ameerId !== ameerId) {
      return res.status(403).json({ message: "You can only manage your assigned trips" });
    }
    if (trip.status !== "OPEN") {
      return res.status(403).json({ message: "You can only manage open trips" });
    }
  }

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      date: date ? new Date(date) : undefined,
      category,
      description,
      amount: amount !== undefined ? Number(amount) : undefined,
      tripId: tripId !== undefined ? (tripId ? Number(tripId) : null) : undefined
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







