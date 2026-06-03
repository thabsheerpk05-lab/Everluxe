import express from "express";
import prisma from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { hasPermission, getAmeerContext } from "../lib/permissions.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();
const allowedTravelerTypes = ["FAMILY", "BACHELOR", "LADY"];
const allowedStatuses = ["ACTIVE", "CANCELLED"];
const allowedPaymentStatuses = ["PAID", "PARTIAL", "UNPAID"];
const allowedServiceDirections = ["INBOUND", "OUTBOUND"];

const normalizeServiceProviderId = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeServiceDirection = (value) => {
  const direction = String(value || "").trim().toUpperCase();
  return allowedServiceDirections.includes(direction) ? direction : "";
};

const normalizeFamilyMembers = (members) => {
  if (!Array.isArray(members)) return [];
  return members
    .map((item) => {
      if (!item) return null;
      if (typeof item === "string") {
        return { name: item };
      }
      return { name: item.name, passportOrIqama: item.passportOrIqama };
    })
    .map((item) => ({
      name: String(item?.name || "").trim(),
      passportOrIqama: String(item?.passportOrIqama || "").trim()
    }))
    .filter((item) => item.name)
    .map((item) => ({
      name: item.name,
      passportOrIqama: item.passportOrIqama || null
    }));
};

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

router.get("/", authenticate, asyncHandler(async (req, res) => {
  if (!hasPermission(req.user, "can_view_travelers")) {
    return res.status(403).json({ message: "Access denied" });
  }

  const tripId = req.query.tripId ? Number(req.query.tripId) : undefined;
  const q = (req.query.q || "").toString().trim();
  const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null;
  const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : null;
  const ameerId = getAmeerContext(req.user);

  const where = tripId ? { tripId } : {};
  if (ameerId) {
    where.trip = { ameerId, status: "OPEN" };
  }
  if (q) {
    where.OR = [
      { travelerName: { contains: q, mode: "insensitive" } },
      { passportOrIqama: { contains: q, mode: "insensitive" } },
      { phoneNumber: { contains: q, mode: "insensitive" } },
      { familyMembers: { some: { name: { contains: q, mode: "insensitive" } } } },
      { familyMembers: { some: { passportOrIqama: { contains: q, mode: "insensitive" } } } }
    ];
  }
  if (dateFrom || dateTo) {
    const tripWhere = where.trip ? { ...where.trip } : {};
    tripWhere.tripDate = {};
    if (dateFrom) {
      tripWhere.tripDate.gte = dateFrom;
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      tripWhere.tripDate.lte = end;
    }
    where.trip = tripWhere;
  }

  const travelers = await prisma.traveler.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      trip: { include: { package: true } },
      familyMembers: { orderBy: { id: "asc" } },
      serviceProvider: true,
      createdBy: { select: { id: true, name: true, email: true } }
    }
  });

  return res.json(travelers);
}));

router.get("/search", authenticate, asyncHandler(async (req, res) => {
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
      { travelerName: { contains: q, mode: "insensitive" } },
      { passportOrIqama: { contains: q, mode: "insensitive" } },
      { phoneNumber: { contains: q, mode: "insensitive" } },
      { familyMembers: { some: { name: { contains: q, mode: "insensitive" } } } },
      { familyMembers: { some: { passportOrIqama: { contains: q, mode: "insensitive" } } } }
    ]
  };

  if (ameerId) {
    where.trip = { ameerId, status: "OPEN" };
  }

  const travelers = await prisma.traveler.findMany({
    where,
    include: {
      trip: { include: { package: true } },
      familyMembers: { orderBy: { id: "asc" } },
      serviceProvider: true
    },
    take: 20
  });

  return res.json(travelers);
}));

router.post("/", authenticate, asyncHandler(async (req, res) => {
  if (!hasPermission(req.user, "can_edit_travelers")) {
    return res.status(403).json({ message: "Access denied" });
  }

  const {
    travelerName,
    passportOrIqama,
    phoneNumber,
    travelerType,
    familyCount,
    familyMembers,
    coPassengers,
    tripId,
    amountPaid,
    paymentType,
    paymentMethod,
    extraRoomCharge,
    customPrice,
    status,
    serviceProviderId,
    serviceDirection,
    paymentAmount,
    discountAmount
  } = req.body || {};

  if (!travelerName || !passportOrIqama || !travelerType || !tripId) {
    return res.status(400).json({ message: "Required fields are missing" });
  }

  if (!allowedTravelerTypes.includes(travelerType)) {
    return res.status(400).json({ message: "Invalid traveler type" });
  }

  if (travelerType !== "FAMILY" && !phoneNumber) {
    return res.status(400).json({ message: "Phone number is required for bachelor and lady travelers" });
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
  if (!ameerId && trip.status !== "OPEN") {
    return res.status(400).json({ message: "Cannot add travelers to a finished trip" });
  }

  const normalizedProviderId = normalizeServiceProviderId(serviceProviderId) ?? null;
  const provider = normalizedProviderId
    ? await prisma.serviceProvider.findUnique({ where: { id: normalizedProviderId } })
    : null;
  if (normalizedProviderId && !provider) {
    return res.status(400).json({ message: "Service provider not found" });
  }
  const normalizedDirection = normalizeServiceDirection(serviceDirection);
  if (provider && !provider.isMain && !normalizedDirection) {
    return res.status(400).json({ message: "Inbound or outbound is required for other service providers" });
  }
  const resolvedServiceDirection = provider && !provider.isMain ? normalizedDirection : null;

  const nextStatus = status || "ACTIVE";
  if (nextStatus !== "CANCELLED") {
    const activeAgg = await prisma.traveler.aggregate({
      where: { tripId: Number(tripId), status: "ACTIVE" },
      _sum: { familyCount: true }
    });
    const activeCount = activeAgg._sum.familyCount || 0;
    const incomingCount = Number(familyCount || 1);
    if (activeCount + incomingCount > 50) {
      return res.status(400).json({ message: "Trip already has 50 active travelers" });
    }
  }

  const normalizedMembers = travelerType === "FAMILY" ? normalizeFamilyMembers(familyMembers) : [];
  const computedFamilyCount = travelerType === "FAMILY"
    ? 1 + normalizedMembers.length
    : Number(familyCount || 1);
  const customPriceValue = customPrice ?? discountAmount ?? 0;
  const amountPaidValue = amountPaid ?? paymentAmount ?? 0;
  const finalAmount = calcFinalAmount(trip.seasonalPrice, extraRoomCharge, customPriceValue, computedFamilyCount);
  const normalizedPayment = normalizePayment(amountPaidValue, finalAmount, paymentType);

  const created = await prisma.traveler.create({
    data: {
      travelerName,
      passportOrIqama,
      phoneNumber: phoneNumber || "",
      travelerType,
      familyCount: Number(computedFamilyCount || 1),
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
      serviceProviderId: normalizedProviderId,
      serviceDirection: resolvedServiceDirection,
      createdById: req.user.id,
      familyMembers: normalizedMembers.length ? { create: normalizedMembers } : undefined
    }
  });

  return res.status(201).json(created);
}));

router.put("/:id", authenticate, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.traveler.findUnique({
    where: { id },
    include: { trip: true, serviceProvider: true }
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
    familyMembers,
    coPassengers,
    tripId,
    amountPaid,
    paymentType,
    paymentMethod,
    extraRoomCharge,
    customPrice,
    status,
    serviceProviderId,
    serviceDirection,
    paymentAmount,
    discountAmount
  } = req.body || {};

  if (canEditTravelers && travelerType && !allowedTravelerTypes.includes(travelerType)) {
    return res.status(400).json({ message: "Invalid traveler type" });
  }

  if (canEditTravelers && travelerType && travelerType !== "FAMILY" && !phoneNumber) {
    return res.status(400).json({ message: "Phone number is required for bachelor and lady travelers" });
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
  if (!ameerId && tripId && trip.status !== "OPEN") {
    return res.status(400).json({ message: "Cannot move travelers to a finished trip" });
  }

  const serviceProviderTouched = canEditTravelers && (serviceProviderId !== undefined || serviceDirection !== undefined);
  let resolvedProviderId = existing.serviceProviderId;
  let resolvedProvider = existing.serviceProvider;
  if (canEditTravelers && serviceProviderId !== undefined) {
    resolvedProviderId = normalizeServiceProviderId(serviceProviderId);
    resolvedProvider = resolvedProviderId
      ? await prisma.serviceProvider.findUnique({ where: { id: resolvedProviderId } })
      : null;
    if (resolvedProviderId && !resolvedProvider) {
      return res.status(400).json({ message: "Service provider not found" });
    }
  }
  const requestedDirection = serviceDirection !== undefined
    ? normalizeServiceDirection(serviceDirection)
    : existing.serviceDirection;
  if (serviceProviderTouched && serviceDirection && !requestedDirection) {
    return res.status(400).json({ message: "Invalid service direction" });
  }
  if (serviceProviderTouched && resolvedProvider && !resolvedProvider.isMain && !requestedDirection) {
    return res.status(400).json({ message: "Inbound or outbound is required for other service providers" });
  }
  const resolvedServiceDirection = resolvedProvider && !resolvedProvider.isMain ? requestedDirection : null;

  const normalizedMembers = Array.isArray(familyMembers)
    ? normalizeFamilyMembers(familyMembers)
    : null;
  const nextExtra = extraRoomCharge ?? existing.extraRoomCharge;
  const nextCustom = customPrice ?? discountAmount ?? existing.customPrice;
  let resolvedFamilyCount = existing.familyCount;
  if (travelerType) {
    resolvedFamilyCount = travelerType === "FAMILY"
      ? 1 + (normalizedMembers ? normalizedMembers.length : Math.max(existing.familyCount - 1, 0))
      : 1;
  } else if (normalizedMembers) {
    resolvedFamilyCount = 1 + normalizedMembers.length;
  } else if (familyCount !== undefined) {
    resolvedFamilyCount = Number(familyCount) || 1;
  }
  const finalAmount = calcFinalAmount(trip.seasonalPrice, nextExtra, nextCustom, resolvedFamilyCount);
  const nextAmountPaid = amountPaid ?? paymentAmount ?? existing.amountPaid;
  const normalizedPayment = normalizePayment(nextAmountPaid, finalAmount, paymentType);

  const data = {};
  if (canEditTravelers) {
    data.travelerName = travelerName;
    data.passportOrIqama = passportOrIqama;
    data.phoneNumber = phoneNumber ?? existing.phoneNumber;
    data.travelerType = travelerType;
    data.familyCount = Number.isFinite(resolvedFamilyCount) ? Number(resolvedFamilyCount) : undefined;
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
    data.serviceProviderId = serviceProviderId !== undefined ? resolvedProviderId : undefined;
    data.serviceDirection = serviceProviderId !== undefined || serviceDirection !== undefined ? resolvedServiceDirection : undefined;
    if (normalizedMembers) {
      data.familyMembers = {
        deleteMany: {},
        create: normalizedMembers
      };
    }
  } else {
    data.amountPaid = amountPaid !== undefined || paymentAmount !== undefined ? normalizedPayment.amountPaid : undefined;
    data.paymentType = amountPaid !== undefined || paymentAmount !== undefined || paymentType ? normalizedPayment.paymentType : undefined;
    data.paymentMethod = paymentMethod;
    data.paymentStatus = normalizedPayment.paymentStatus;
    data.extraRoomCharge = extraRoomCharge !== undefined ? Number(extraRoomCharge) : undefined;
    data.customPrice = customPrice !== undefined || discountAmount !== undefined ? Number(nextCustom) : undefined;
    data.finalAmount = finalAmount;
    if (normalizedMembers) {
      data.familyMembers = {
        deleteMany: {},
        create: normalizedMembers
      };
    }
  }

  const updated = await prisma.traveler.update({
    where: { id },
    data
  });

  return res.json(updated);
}));

router.delete("/:id", authenticate, asyncHandler(async (req, res) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Admin access required" });
  }

  const id = Number(req.params.id);
  await prisma.traveler.delete({ where: { id } });
  return res.status(204).send();
}));

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

















