import express from "express";
import prisma from "../lib/prisma.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();

const normalizeBoolean = (value) => value === true || value === "true" || value === "MAIN";

router.get("/", authenticate, asyncHandler(async (req, res) => {
  const providers = await prisma.serviceProvider.findMany({
    orderBy: [{ isMain: "desc" }, { providerName: "asc" }]
  });
  return res.json(providers);
}));

router.post("/", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { providerName, isMain } = req.body || {};
  if (!providerName) {
    return res.status(400).json({ message: "Provider name is required" });
  }

  const makeMain = normalizeBoolean(isMain);
  const created = await prisma.$transaction(async (tx) => {
    if (makeMain) {
      await tx.serviceProvider.updateMany({ data: { isMain: false } });
    }
    return tx.serviceProvider.create({ data: { providerName, isMain: makeMain } });
  });
  return res.status(201).json(created);
}));

router.put("/:id", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { providerName, isMain } = req.body || {};
  const makeMain = isMain === undefined ? undefined : normalizeBoolean(isMain);
  const updated = await prisma.$transaction(async (tx) => {
    if (makeMain) {
      await tx.serviceProvider.updateMany({
        where: { id: { not: id } },
        data: { isMain: false }
      });
    }
    return tx.serviceProvider.update({
      where: { id },
      data: {
        providerName,
        isMain: makeMain
      }
    });
  });
  return res.json(updated);
}));

router.delete("/:id", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.serviceProvider.findUnique({ where: { id } });
  if (existing?.isMain) {
    return res.status(400).json({ message: "Main provider cannot be deleted" });
  }
  await prisma.serviceProvider.delete({ where: { id } });
  return res.status(204).send();
}));
export default router;



