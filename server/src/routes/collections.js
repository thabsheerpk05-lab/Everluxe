import express from "express";
import prisma from "../lib/prisma.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authenticate, requireAdmin, async (req, res) => {
  const collections = await prisma.tripCollection.findMany({
    orderBy: { date: "desc" },
    include: {
      trip: { include: { package: true } },
      ameer: true,
      receivedByAdmin: { select: { id: true, name: true, email: true } }
    }
  });
  return res.json(collections);
});

router.post("/", authenticate, requireAdmin, async (req, res) => {
  const { tripId, ameerId, amountReceived, date } = req.body || {};
  if (!tripId || !ameerId || !amountReceived || !date) {
    return res.status(400).json({ message: "Trip, ameer, amount, and date are required" });
  }

  const created = await prisma.tripCollection.create({
    data: {
      tripId: Number(tripId),
      ameerId: Number(ameerId),
      amountReceived: Number(amountReceived),
      date: new Date(date),
      receivedByAdminId: req.user.id
    }
  });

  return res.status(201).json(created);
});

export default router;
