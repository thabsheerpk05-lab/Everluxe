import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

export const DEFAULT_LOGO_URL = "/brand/everluxe-logo.png";
export const DEFAULT_BUSINESS_PROFILE = {
  id: 1,
  businessName: "EVERLUXE EVENTS",
  publicEmail: "everluxeevents123@gmail.com",
  phone: "+91 97452 27257",
  whatsapp: "+91 97452 27257",
  instagram: "ever.luxe_events",
  location: "Nilambur, Malappuram, Kerala, India",
  serviceArea: "Across Kerala",
  description: "Elegant stages, entrances and event spaces designed to make special moments unforgettable.",
  heroMode: "DEFAULT",
  heroImageUrl: null,
  logoUrl: DEFAULT_LOGO_URL
};

export function slugify(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 72);
}

export function makePublicId(prefix) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export function publicProfile(profile) {
  return { ...DEFAULT_BUSINESS_PROFILE, ...(profile || {}), logoUrl: profile?.logoUrl || DEFAULT_LOGO_URL };
}

export function parseDataUrl(dataUrl) {
  const matched = /^data:(image\/(?:png|jpe?g|webp));base64,([a-z0-9+/=]+)$/i.exec(dataUrl || "");
  if (!matched) throw new Error("Upload a PNG, JPEG, or WebP image.");
  const buffer = Buffer.from(matched[2], "base64");
  if (!buffer.length || buffer.length > 8 * 1024 * 1024) throw new Error("Images must be between 1 byte and 8 MB.");
  const extension = matched[1] === "image/png" ? "png" : matched[1] === "image/webp" ? "webp" : "jpg";
  return { buffer, extension };
}

export async function storeImage(dataUrl) {
  const { buffer, extension } = parseDataUrl(dataUrl);
  if (process.env.VERCEL) {
    // Vercel function files are not durable. Keeping the validated data URL in
    // the existing database preserves uploads without introducing a new service.
    return `data:image/${extension === "jpg" ? "jpeg" : extension};base64,${buffer.toString("base64")}`;
  }
  const directory = process.env.UPLOADS_DIR || path.resolve(process.cwd(), "uploads");
  await fs.mkdir(directory, { recursive: true });
  const filename = `${crypto.randomUUID()}.${extension}`;
  await fs.writeFile(path.join(directory, filename), buffer, { flag: "wx" });
  return `/uploads/${filename}`;
}

export async function recordActivity(prisma, userId, action, entityType, entityId, metadata = null) {
  await prisma.activityLog.create({ data: { userId, action, entityType, entityId: String(entityId), metadata: metadata ? JSON.stringify(metadata) : null } });
}
