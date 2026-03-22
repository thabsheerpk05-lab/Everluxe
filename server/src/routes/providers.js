import express from "express";
import prisma from "../lib/prisma.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();

router.get("/", authenticate, asyncHandler(async (req, res) => {
  const providers = await prisma.serviceProvider.findMany({ orderBy: { id: "asc" } });
  return res.json(providers);
}));

router.post("/", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { providerName } = req.body || {};
  if (!providerName) {
    return res.status(400).json({ message: "Provider name is required" });
  }

  const created = await prisma.serviceProvider.create({ data: { providerName } });
  return res.status(201).json(created);
}));

router.put("/:id", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { providerName } = req.body || {};
  const updated = await prisma.serviceProvider.update({
    where: { id },
    data: { providerName }
  });
  return res.json(updated);
}));

router.delete("/:id", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await prisma.serviceProvider.delete({ where: { id } });
  return res.status(204).send();
}));
export default router;



