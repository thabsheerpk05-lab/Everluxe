import express from "express";
import prisma from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { hasPermission, getAmeerContext } from "../lib/permissions.js";

const router = express.Router();

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date) {
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

function buildMonthRange(baseDate, count) {
  const months = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
    months.push({ key: monthKey(d), label: monthLabel(d) });
  }
  return months;
}

function unpaidAmount(traveler) {
  const due = Number(traveler.finalAmount || 0) - Number(traveler.amountPaid || 0);
  return due > 0 ? due : 0;
}

const activeFilter = { OR: [{ status: "ACTIVE" }] };
const INTERNAL_PROVIDER = "wadinoor";

function normalizeProviderName(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "");
}

router.get("/summary", authenticate, async (req, res) => {
  if (!hasPermission(req.user, "can_view_reports")) {
    return res.status(403).json({ message: "Access denied" });
  }

  const ameerId = getAmeerContext(req.user);
  const tripWhere = ameerId ? { ameerId } : {};

  const [tripCount, travelerCount] = await Promise.all([
    prisma.trip.count({ where: tripWhere }),
    prisma.traveler.count(ameerId ? { where: { trip: { ameerId } } } : undefined)
  ]);

  const revenueAgg = await prisma.traveler.aggregate({
  where: {
    status: "ACTIVE",
    ...(ameerId ? { trip: { ameerId } } : {})
  },
  _sum: {
    amountPaid: true
  }
});

  const totalRevenue = revenueAgg._sum.amountPaid || 0;
  const expenseAgg = await prisma.expense.aggregate({
  _sum: {
    amount: true
  }
});
  const totalExpenses = expenseAgg._sum.amount || 0;
  const netProfit = totalRevenue - totalExpenses;

  const travelers = await prisma.traveler.findMany({
    where: {
      ...activeFilter,
      ...(ameerId ? { trip: { ameerId } } : {})
    },
    select: { createdAt: true, amountPaid: true, paymentStatus: true, finalAmount: true }
  });
  const expenses = await prisma.expense.findMany({
    select: { date: true, amount: true }
  });

  const revenueMap = new Map();
  let totalUnpaid = 0;
  for (const traveler of travelers) {
    const key = monthKey(traveler.createdAt);
    revenueMap.set(key, (revenueMap.get(key) || 0) + traveler.amountPaid);
    if (traveler.paymentStatus !== "PAID") {
      totalUnpaid += unpaidAmount(traveler);
    }
  }

  const expenseMap = new Map();
  for (const expense of expenses) {
    const key = monthKey(expense.date);
    expenseMap.set(key, (expenseMap.get(key) || 0) + expense.amount);
  }

  const months = buildMonthRange(new Date(), 12);
  const monthly = months.map((month) => {
    const revenue = revenueMap.get(month.key) || 0;
    const exp = expenseMap.get(month.key) || 0;
    return {
      month: month.label,
      revenue,
      expenses: exp,
      profit: revenue - exp
    };
  });

  return res.json({
    totals: {
      totalTrips: tripCount,
      totalTravelers: travelerCount,
      totalRevenue,
      totalExpenses,
      netProfit,
      totalUnpaid
    },
    monthly
  });
});

router.get("/trip/:tripId", authenticate, async (req, res) => {
  if (!hasPermission(req.user, "can_view_reports")) {
    return res.status(403).json({ message: "Access denied" });
  }

  const tripId = Number(req.params.tripId);
  const ameerId = getAmeerContext(req.user);
  if (ameerId) {
    const tripCheck = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!tripCheck || tripCheck.ameerId !== ameerId) {
      return res.status(403).json({ message: "Access denied" });
    }
  }

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { package: true, driver: true, coDriver: true, ameer: true, bus: true }
  });

  const travelers = await prisma.traveler.findMany({
    where: { tripId, ...activeFilter },
    orderBy: { createdAt: "asc" }
  });

  const formatted = travelers.map((traveler, index) => ({
    serial: index + 1,
    travelerName: traveler.travelerName,
    passportOrIqama: traveler.passportOrIqama,
    phoneNumber: traveler.phoneNumber,
    travelerType: traveler.travelerType,
    familyCount: traveler.familyCount,
    coPassengers: traveler.coPassengers,
    paymentStatus: traveler.paymentStatus
  }));

  return res.json({
    tripId,
    tripMeta: {
      busNumber: trip?.bus?.busNumber,
      busName: trip?.bus?.busName,
      tripDate: trip?.tripDate,
      route: trip?.package?.route,
      driverName: trip?.driver?.driverName,
      driverIqama: trip?.driver?.passportNumber,
      coDriverName: trip?.coDriver?.driverName,
      coDriverIqama: trip?.coDriver?.passportNumber,
      ameerName: trip?.ameer?.name,
      ameerIqama: trip?.ameer?.passportNumber
    },
    passengers: formatted
  });
});

router.get("/financial", authenticate, async (req, res) => {
  if (!hasPermission(req.user, "can_view_reports")) {
    return res.status(403).json({ message: "Access denied" });
  }

  const year = Number(req.query.year) || new Date().getFullYear();
  const months = Array.from({ length: 12 }, (_, idx) => {
    const date = new Date(year, idx, 1);
    return { key: monthKey(date), label: monthLabel(date) };
  });

  const ameerId = getAmeerContext(req.user);
  const travelers = await prisma.traveler.findMany({
    where: {
      ...activeFilter,
      ...(ameerId ? { trip: { ameerId } } : {})
    },
    select: {
      createdAt: true,
      amountPaid: true,
      serviceProvider: { select: { providerName: true } }
    }
  });
  const expenses = await prisma.expense.findMany({
    select: { date: true, amount: true, category: true }
  });

  const revenueMap = new Map();
  const internalRevenueMap = new Map();
  const externalRevenueMap = new Map();
  for (const traveler of travelers) {
    const key = monthKey(traveler.createdAt);
    const amount = Number(traveler.amountPaid || 0);
    revenueMap.set(key, (revenueMap.get(key) || 0) + amount);
    const providerName = normalizeProviderName(traveler.serviceProvider?.providerName);
    const isInternal = !providerName || providerName === INTERNAL_PROVIDER;
    const targetMap = isInternal ? internalRevenueMap : externalRevenueMap;
    targetMap.set(key, (targetMap.get(key) || 0) + amount);
  }

  const expenseMap = new Map();
  const expenseCategoryMap = new Map();
  for (const expense of expenses) {
    const key = monthKey(expense.date);
    const amount = Number(expense.amount || 0);
    expenseMap.set(key, (expenseMap.get(key) || 0) + amount);
    const category = expense.category || "OTHER";
    if (!expenseCategoryMap.has(key)) {
      expenseCategoryMap.set(key, {});
    }
    const bucket = expenseCategoryMap.get(key);
    bucket[category] = (bucket[category] || 0) + amount;
  }

  const monthly = months.map((month) => {
    const revenue = revenueMap.get(month.key) || 0;
    const exp = expenseMap.get(month.key) || 0;
    const internalRevenue = internalRevenueMap.get(month.key) || 0;
    const externalRevenue = externalRevenueMap.get(month.key) || 0;
    const expenseByCategory = expenseCategoryMap.get(month.key) || {};
    return {
      month: month.label,
      revenue,
      expenses: exp,
      profit: revenue - exp,
      internalRevenue,
      externalRevenue,
      expenseByCategory
    };
  });

  const totalRevenue = monthly.reduce((sum, m) => sum + m.revenue, 0);
  const totalExpenses = monthly.reduce((sum, m) => sum + m.expenses, 0);

  return res.json({
    year,
    totalRevenue,
    totalExpenses,
    netProfit: totalRevenue - totalExpenses,
    monthly
  });
});

router.get("/unpaid", authenticate, async (req, res) => {
  if (!hasPermission(req.user, "can_view_reports")) {
    return res.status(403).json({ message: "Access denied" });
  }

  const { tripId, dateFrom, dateTo, serviceProviderId } = req.query;
  const ameerId = getAmeerContext(req.user);

  const where = {
    ...activeFilter,
    paymentStatus: { not: "PAID" }
  };

  if (tripId) {
    where.tripId = Number(tripId);
  }

  if (serviceProviderId) {
    where.serviceProviderId = Number(serviceProviderId);
  }

  if (ameerId) {
    where.trip = { ameerId };
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) {
      where.createdAt.gte = new Date(dateFrom);
    }
    if (dateTo) {
      where.createdAt.lte = new Date(dateTo);
    }
  }

  const travelers = await prisma.traveler.findMany({
    where,
    include: {
      trip: { include: { package: true } },
      serviceProvider: true
    },
    orderBy: { createdAt: "desc" }
  });

  const rows = travelers.map((traveler) => ({
    id: traveler.id,
    travelerName: traveler.travelerName,
    passportOrIqama: traveler.passportOrIqama,
    phoneNumber: traveler.phoneNumber,
    trip: traveler.trip,
    serviceProvider: traveler.serviceProvider,
    paymentStatus: traveler.paymentStatus,
    amountPaid: traveler.amountPaid,
    finalAmount: traveler.finalAmount,
    unpaidAmount: unpaidAmount(traveler),
    createdAt: traveler.createdAt
  }));

  const totalUnpaid = rows.reduce((sum, row) => sum + row.unpaidAmount, 0);

  return res.json({
    totalUnpaid,
    travelers: rows
  });
});

export default router;
