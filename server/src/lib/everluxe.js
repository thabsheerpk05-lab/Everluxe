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

export function parseDataUrl(dataUrl, allowVideo = false) {
  const types = allowVideo ? "image\/(?:png|jpe?g|webp)|video\/(?:mp4|webm|quicktime)" : "image\/(?:png|jpe?g|webp)";
  const matched = new RegExp(`^data:(${types});base64,([a-z0-9+/=]+)$`, "i").exec(dataUrl || "");
  if (!matched) { const error = new Error(allowVideo ? "Upload a PNG, JPEG, WebP, MP4, WebM, or MOV file." : "Upload a PNG, JPEG, or WebP image."); error.statusCode = 400; throw error; }
  return parseBuffer(Buffer.from(matched[2], "base64"), matched[1], allowVideo);
}

export function parseBuffer(buffer, mimeType, allowVideo = false) {
  const normalizedType = String(mimeType || "").split(";", 1)[0].toLowerCase();
  const imageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
  const videoTypes = new Set(["video/mp4", "video/webm", "video/quicktime"]);
  const valid = imageTypes.has(normalizedType) || (allowVideo && videoTypes.has(normalizedType));
  if (!valid) { const error = new Error(allowVideo ? "Upload a PNG, JPEG, WebP, MP4, WebM, or MOV file." : "Upload a PNG, JPEG, or WebP image."); error.statusCode = 400; throw error; }
  const isVideo = videoTypes.has(normalizedType);
  const limit = isVideo ? 40 * 1024 * 1024 : 8 * 1024 * 1024;
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > limit) { const error = new Error(`Files must be between 1 byte and ${isVideo ? 40 : 8} MB.`); error.statusCode = 400; throw error; }
  const extension = normalizedType === "image/png" ? "png" : normalizedType === "image/webp" ? "webp" : normalizedType === "video/mp4" ? "mp4" : normalizedType === "video/webm" ? "webm" : normalizedType === "video/quicktime" ? "mov" : "jpg";
  return { buffer, extension, mimeType: normalizedType };
}

export async function storeBuffer(buffer, mimeType, allowVideo = false) {
  const { extension } = parseBuffer(buffer, mimeType, allowVideo);
  if (process.env.VERCEL || process.env.MEDIA_STORAGE_PROVIDER === "object") {
    const error = new Error("Persistent media storage is not configured for this environment."); error.statusCode = 503; throw error;
  }
  const directory = process.env.UPLOADS_DIR || path.resolve(process.cwd(), "uploads");
  await fs.mkdir(directory, { recursive: true });
  const filename = `${crypto.randomUUID()}.${extension}`;
  await fs.writeFile(path.join(directory, filename), buffer, { flag: "wx" });
  return `/uploads/${filename}`;
}

export async function storeImage(dataUrl, allowVideo = false) {
  const { buffer, mimeType } = parseDataUrl(dataUrl, allowVideo);
  return storeBuffer(buffer, mimeType, allowVideo);
}

export async function recordActivity(prisma, userId, action, entityType, entityId, metadata = null) {
  await prisma.activityLog.create({ data: { userId, action, entityType, entityId: String(entityId), metadata: metadata ? JSON.stringify(metadata) : null } });
}
