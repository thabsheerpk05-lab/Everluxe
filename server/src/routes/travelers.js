import express from "express";
import prisma from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { hasPermission, getAmeerContext } from "../lib/permissions.js";

const router = express.Router();
const allowedTravelerTypes = ["FAMILY", "BACHELOR"];
const allowedStatuses = ["ACTIVE", "CANCELLED"];
const allowedPaymentStatuses = ["PAID", "PARTIAL", "UNPAID"];

function calcFinalAmount(seasonalPrice, extraRoomCharge, customPrice, familyCount = 1) {
  const base = Number(customPrice) || Number(seasonalPrice) || 0;
  const extra = Number(extraRoomCharge) || 0;
  const count = Number(familyCount) || 1;
  return Math.max(base * count + extra, 0);
}

async function getTripPrice(tripId) {
  const trip = await prisma.trip.findUnique({
    where: { id: Number(tripId) },
    select: { seasonalPrice: true, ameerId: true, status: true }
  });
  return trip;
}

router.get("/", authenticate, async (req, res) => {
  if (!hasPermission(req.user, "can_view_travelers")) {
    return res.status(403).json({ message: "Access denied" });
  }

  const tripId = req.query.tripId ? Number(req.query.tripId) : undefined;
  const ameerId = getAmeerContext(req.user);

  const where = tripId ? { tripId } : {};
  if (ameerId) {
    where.trip = { ameerId, status: "OPEN" };
  }

  const travelers = await prisma.traveler.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      trip: { include: { package: true } },
      serviceProvider: true,
      createdBy: { select: { id: true, name: true, email: true } }
    }
  });

  return res.json(travelers);
});

router.get("/search", authenticate, async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payments")) {
    return res.status(403).json({ message: "Access denied" });
  }

  const q = (req.query.q || "").toString().toLowerCase();
  if (!q) {
    return res.json([]);
  }

  const ameerId = getAmeerContext(req.user);
  const where = {
    OR: [
      { travelerName: { contains: q } },
      { passportOrIqama: { contains: q } },
      { phoneNumber: { contains: q } }
    ]
  };

  if (ameerId) {
    where.trip = { ameerId, status: "OPEN" };
  }

  const travelers = await prisma.traveler.findMany({
    where,
    include: {
      trip: { include: { package: true } },
      serviceProvider: true
    },
    take: 20
  });

  return res.json(travelers);
});

router.post("/", authenticate, async (req, res) => {
  if (!hasPermission(req.user, "can_edit_travelers")) {
    return res.status(403).json({ message: "Access denied" });
  }

  const {
    travelerName,
    passportOrIqama,
    phoneNumber,
    travelerType,
    familyCount,
    coPassengers,
    tripId,
    amountPaid,
    paymentType,
    paymentMethod,
    extraRoomCharge,
    customPrice,
    status,
    serviceProviderId,
    paymentAmount,
    discountAmount
  } = req.body || {};

  if (!travelerName || !passportOrIqama || !travelerType || !tripId || !serviceProviderId) {
    return res.status(400).json({ message: "Required fields are missing" });
  }

  if (!allowedTravelerTypes.includes(travelerType)) {
    return res.status(400).json({ message: "Invalid traveler type" });
  }

  if (travelerType === "BACHELOR" && !phoneNumber) {
    return res.status(400).json({ message: "Phone number is required for bachelor travelers" });
  }

  if (status && !allowedStatuses.includes(status)) {
    return res.status(400).json({ message: "Invalid traveler status" });
  }

  if (paymentType && !["FULL", "PARTIAL"].includes(paymentType)) {
    return res.status(400).json({ message: "Invalid payment type" });
  }

  const trip = await getTripPrice(tripId);
  if (!trip) {
    return res.status(400).json({ message: "Trip not found" });
  }

  const ameerId = getAmeerContext(req.user);
  if (ameerId && trip.ameerId !== ameerId) {
    return res.status(403).json({ message: "You can only manage your assigned trips" });
  }
  if (ameerId && trip.status !== "OPEN") {
    return res.status(403).json({ message: "You can only manage open trips" });
  }

  const customPriceValue = customPrice ?? discountAmount ?? 0;
  const amountPaidValue = amountPaid ?? paymentAmount ?? 0;
  const finalAmount = calcFinalAmount(trip.seasonalPrice, extraRoomCharge, customPriceValue, familyCount);
  const normalizedPayment = normalizePayment(amountPaidValue, finalAmount, paymentType);

  const created = await prisma.traveler.create({
    data: {
      travelerName,
      passportOrIqama,
      phoneNumber: phoneNumber || "",
      travelerType,
      familyCount: Number(familyCount || 1),
      coPassengers: coPassengers || null,
      tripId: Number(tripId),
      amountPaid: normalizedPayment.amountPaid,
      paymentType: normalizedPayment.paymentType,
      paymentStatus: normalizedPayment.paymentStatus,
      paymentMethod: paymentMethod || "Cash",
      extraRoomCharge: Number(extraRoomCharge || 0),
      customPrice: Number(customPriceValue || 0),
      finalAmount,
      status: status || "ACTIVE",
      serviceProviderId: Number(serviceProviderId),
      createdById: req.user.id
    }
  });

  return res.status(201).json(created);
});

router.put("/:id", authenticate, async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.traveler.findUnique({
    where: { id },
    include: { trip: true }
  });
  if (!existing) {
    return res.status(404).json({ message: "Traveler not found" });
  }

  const canEditTravelers = hasPermission(req.user, "can_edit_travelers");
  const canManagePayments = hasPermission(req.user, "can_manage_payments");
  if (!canEditTravelers && !canManagePayments) {
    return res.status(403).json({ message: "Access denied" });
  }

  const ameerId = getAmeerContext(req.user);
  const isAmeer = ameerId && existing.trip?.ameerId === ameerId;
  if (ameerId && !isAmeer) {
    return res.status(403).json({ message: "You can only manage your assigned trips" });
  }

  if (req.user.role !== "ADMIN" && !isAmeer && existing.createdById !== req.user.id) {
    return res.status(403).json({ message: "You can only edit travelers you created" });
  }

  const {
    travelerName,
    passportOrIqama,
    phoneNumber,
    travelerType,
    familyCount,
    coPassengers,
    tripId,
    amountPaid,
    paymentType,
    paymentMethod,
    extraRoomCharge,
    customPrice,
    status,
    serviceProviderId,
    paymentAmount,
    discountAmount
  } = req.body || {};

  if (canEditTravelers && travelerType && !allowedTravelerTypes.includes(travelerType)) {
    return res.status(400).json({ message: "Invalid traveler type" });
  }

  if (canEditTravelers && travelerType === "BACHELOR" && !phoneNumber) {
    return res.status(400).json({ message: "Phone number is required for bachelor travelers" });
  }

  if (canEditTravelers && status && !allowedStatuses.includes(status)) {
    return res.status(400).json({ message: "Invalid traveler status" });
  }

  if (paymentType && !["FULL", "PARTIAL"].includes(paymentType)) {
    return res.status(400).json({ message: "Invalid payment type" });
  }

  const targetTripId = tripId || existing.tripId;
  const trip = await getTripPrice(targetTripId);
  if (!trip) {
    return res.status(400).json({ message: "Trip not found" });
  }

  if (ameerId && trip.ameerId !== ameerId) {
    return res.status(403).json({ message: "You can only manage your assigned trips" });
  }
  if (ameerId && trip.status !== "OPEN") {
    return res.status(403).json({ message: "You can only manage open trips" });
  }

  const nextExtra = extraRoomCharge ?? existing.extraRoomCharge;
  const nextCustom = customPrice ?? discountAmount ?? existing.customPrice;
  const nextFamilyCount = familyCount ?? existing.familyCount;
  const finalAmount = calcFinalAmount(trip.seasonalPrice, nextExtra, nextCustom, nextFamilyCount);
  const nextAmountPaid = amountPaid ?? paymentAmount ?? existing.amountPaid;
  const normalizedPayment = normalizePayment(nextAmountPaid, finalAmount, paymentType);

  const data = {};
  if (canEditTravelers) {
    data.travelerName = travelerName;
    data.passportOrIqama = passportOrIqama;
    data.phoneNumber = phoneNumber ?? existing.phoneNumber;
    data.travelerType = travelerType;
    data.familyCount = familyCount !== undefined ? Number(familyCount) : undefined;
    data.coPassengers = coPassengers !== undefined ? coPassengers : undefined;
    data.tripId = tripId ? Number(tripId) : undefined;
    data.amountPaid = amountPaid !== undefined || paymentAmount !== undefined ? normalizedPayment.amountPaid : undefined;
    data.paymentType = amountPaid !== undefined || paymentAmount !== undefined || paymentType ? normalizedPayment.paymentType : undefined;
    data.paymentMethod = paymentMethod;
    data.paymentStatus = normalizedPayment.paymentStatus;
    data.extraRoomCharge = extraRoomCharge !== undefined ? Number(extraRoomCharge) : undefined;
    data.customPrice = customPrice !== undefined || discountAmount !== undefined ? Number(nextCustom) : undefined;
    data.finalAmount = finalAmount;
    data.status = status;
    data.serviceProviderId = serviceProviderId ? Number(serviceProviderId) : undefined;
  } else {
    data.amountPaid = amountPaid !== undefined || paymentAmount !== undefined ? normalizedPayment.amountPaid : undefined;
    data.paymentType = amountPaid !== undefined || paymentAmount !== undefined || paymentType ? normalizedPayment.paymentType : undefined;
    data.paymentMethod = paymentMethod;
    data.paymentStatus = normalizedPayment.paymentStatus;
    data.extraRoomCharge = extraRoomCharge !== undefined ? Number(extraRoomCharge) : undefined;
    data.customPrice = customPrice !== undefined || discountAmount !== undefined ? Number(nextCustom) : undefined;
    data.finalAmount = finalAmount;
  }

  const updated = await prisma.traveler.update({
    where: { id },
    data
  });

  return res.json(updated);
});

router.delete("/:id", authenticate, async (req, res) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Admin access required" });
  }

  const id = Number(req.params.id);
  await prisma.traveler.delete({ where: { id } });
  return res.status(204).send();
});

function normalizePayment(amountPaidInput, finalAmount, paymentTypeInput) {
  const total = Number(finalAmount) || 0;
  const rawPaid = Number(amountPaidInput) || 0;
  let normalizedPaid = rawPaid;
  if (paymentTypeInput === "FULL") {
    normalizedPaid = total;
  } else {
    normalizedPaid = Math.min(rawPaid, total);
  }
  const paymentStatus = derivePaymentStatus(normalizedPaid, total);
  const paymentType = paymentStatus === "PAID" ? "FULL" : paymentStatus === "PARTIAL" ? "PARTIAL" : null;
  return { amountPaid: normalizedPaid, paymentStatus, paymentType };
}
function derivePaymentStatus(amountPaid, finalAmount) {
  const paid = Number(amountPaid) || 0;
  const total = Number(finalAmount) || 0;
  if (paid >= total) return "PAID";
  if (paid > 0) return "PARTIAL";
  return "UNPAID";
}

export default router;














