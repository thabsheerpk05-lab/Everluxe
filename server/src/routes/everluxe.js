import express from "express";
import prisma from "../lib/prisma.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { DEFAULT_BUSINESS_PROFILE, DEFAULT_LOGO_URL, makePublicId, publicProfile, recordActivity, slugify, storeImage } from "../lib/everluxe.js";

const router = express.Router();
const PUBLIC_STATUSES = ["PUBLISHED"];
const active = { status: { in: PUBLIC_STATUSES } };

async function getProfile() {
  const profile = await prisma.businessProfile.upsert({ where: { id: 1 }, update: {}, create: DEFAULT_BUSINESS_PROFILE });
  return publicProfile(profile);
}

function uniqueSlug(name, fallback) {
  const slug = slugify(name);
  if (!slug) throw new Error(`${fallback} name is required`);
  return slug;
}

router.get("/public/settings", asyncHandler(async (_req, res) => res.json(await getProfile())));

router.get("/public/catalogue", asyncHandler(async (req, res) => {
  const where = { ...active, availability: "AVAILABLE" };
  if (req.query.category) where.category = { slug: String(req.query.category) };
  if (req.query.eventType) where.eventType = { slug: String(req.query.eventType) };
  if (req.query.style) where.designStyle = { slug: String(req.query.style) };
  if (req.query.featured === "true") where.featured = true;
  const designs = await prisma.catalogueDesign.findMany({ where, orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }], include: { category: true, eventType: true, designStyle: true, images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }] } } });
  res.json(designs);
}));

router.get("/public/packages", asyncHandler(async (req, res) => {
  const where = { ...active, availability: "AVAILABLE" }; if (req.query.featured === "true") where.featured = true;
  res.json(await prisma.eventPackage.findMany({ where, orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }], include: { items: { include: { design: { include: { images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }] } } } } } } }));
}));

router.get("/public/gallery", asyncHandler(async (_req, res) => {
  res.json(await prisma.galleryItem.findMany({ where: active, orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }] }));
}));

router.get("/public/budget-ranges", asyncHandler(async (_req, res) => res.json(await prisma.budgetRange.findMany({ where: active, orderBy: { displayOrder: "asc" } }))));
router.get("/public/addons", asyncHandler(async (_req, res) => res.json(await prisma.approvedAddon.findMany({ where: active, orderBy: { displayOrder: "asc" } }))));

router.get("/public/taxonomies", asyncHandler(async (_req, res) => {
  const [categories, styles, eventTypes] = await Promise.all([
    prisma.catalogueCategory.findMany({ where: active, orderBy: { displayOrder: "asc" } }),
    prisma.designStyle.findMany({ where: active, orderBy: { displayOrder: "asc" } }),
    prisma.eventType.findMany({ where: active, orderBy: { displayOrder: "asc" } })
  ]);
  res.json({ categories, styles, eventTypes });
}));

router.post("/public/enquiries", asyncHandler(async (req, res) => {
  const { fullName, phone, whatsapp, eventTypeId, eventDate, eventLocation, guestCount, preferredStyle, budgetRange, message, designIds = [], packageIds = [], addonIds = [], attachments = [] } = req.body || {};
  if (!fullName?.trim() || !phone?.trim()) return res.status(400).json({ message: "Full name and phone number are required." });
  const [designs, packages, addons] = await Promise.all([
    designIds.length ? prisma.catalogueDesign.findMany({ where: { id: { in: designIds.map(Number) } } }) : [],
    packageIds.length ? prisma.eventPackage.findMany({ where: { id: { in: packageIds.map(Number) } } }) : [],
    addonIds.length ? prisma.approvedAddon.findMany({ where: { id: { in: addonIds.map(Number) } } }) : []
  ]);
  const privateAttachments = await Promise.all((Array.isArray(attachments) ? attachments : []).slice(0, 5).map(async (item) => ({ fileUrl: item.dataUrl ? await storeImage(item.dataUrl) : item.fileUrl, originalName: item.originalName || "reference-image", mimeType: item.mimeType || "image/*", sizeBytes: Number(item.sizeBytes || 0) })));
  const enquiry = await prisma.eventEnquiry.create({
    data: {
      reference: makePublicId("EVQ"), fullName: fullName.trim(), phone: phone.trim(), whatsapp: whatsapp?.trim() || null,
      eventTypeId: eventTypeId ? Number(eventTypeId) : null, eventDate: eventDate ? new Date(eventDate) : null, eventLocation: eventLocation?.trim() || null,
      guestCount: guestCount ? Number(guestCount) : null, preferredStyle: preferredStyle || null, budgetRange: budgetRange || null, message: message?.trim() || null,
      selectedDesigns: { create: designs.map((design) => ({ designId: design.id, designName: design.name, price: design.price, priceType: design.priceType, priceVisible: design.priceVisibility === "PUBLIC" })) },
      selectedPackages: { create: packages.map((pkg) => ({ packageId: pkg.id, packageName: pkg.name, price: pkg.price, priceType: pkg.priceType, priceVisible: pkg.priceVisibility === "PUBLIC" })) },
      selectedAddons: { create: addons.map((addon) => ({ addonId: addon.id, addonName: addon.name, price: addon.price })) },
      attachments: { create: privateAttachments.filter((item) => item.fileUrl && item.originalName) }
    },
    select: { reference: true, createdAt: true }
  });
  res.status(201).json(enquiry);
}));

router.use("/customer", authenticate);
router.get("/customer/event-profiles", asyncHandler(async (req, res) => {
  const profile = await prisma.customerProfile.findUnique({ where: { userId: req.user.id } });
  if (!profile) return res.json([]);
  res.json(await prisma.eventProfile.findMany({ where: { customerId: profile.id }, orderBy: { updatedAt: "desc" }, include: { eventType: true } }));
}));
router.post("/customer/event-profiles", asyncHandler(async (req, res) => {
  const body = req.body || {}; if (!body.title?.trim()) return res.status(400).json({ message: "Event profile title is required." });
  const profile = await prisma.customerProfile.upsert({ where: { userId: req.user.id }, update: {}, create: { userId: req.user.id } });
  const item = await prisma.eventProfile.create({ data: { customerId: profile.id, title: body.title.trim(), eventTypeId: body.eventTypeId ? Number(body.eventTypeId) : null, eventDate: body.eventDate ? new Date(body.eventDate) : null, location: body.location || null, guestCount: body.guestCount ? Number(body.guestCount) : null, notes: body.notes || null }, include: { eventType: true } });
  res.status(201).json(item);
}));
router.put("/customer/event-profiles/:id", asyncHandler(async (req, res) => {
  const profile = await prisma.customerProfile.findUnique({ where: { userId: req.user.id } });
  const id = Number(req.params.id); const owned = profile && await prisma.eventProfile.findFirst({ where: { id, customerId: profile.id } });
  if (!owned) return res.status(404).json({ message: "Event profile not found." });
  const body = req.body || {}; res.json(await prisma.eventProfile.update({ where: { id }, data: { title: body.title?.trim(), eventTypeId: body.eventTypeId ? Number(body.eventTypeId) : null, eventDate: body.eventDate ? new Date(body.eventDate) : null, location: body.location, guestCount: body.guestCount ? Number(body.guestCount) : null, notes: body.notes } }));
}));

router.use("/admin", authenticate, requireAdmin);

router.get("/admin/dashboard", asyncHandler(async (_req, res) => {
  const [designs, packages, enquiries, recentEnquiries, recentActivity] = await Promise.all([
    prisma.catalogueDesign.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.eventPackage.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.eventEnquiry.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.eventEnquiry.findMany({ take: 5, orderBy: { createdAt: "desc" } }),
    prisma.activityLog.findMany({ take: 8, orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } })
  ]);
  res.json({ designs, packages, enquiries, recentEnquiries, recentActivity });
}));

router.get("/admin/settings", asyncHandler(async (_req, res) => res.json(await getProfile())));
router.put("/admin/settings", asyncHandler(async (req, res) => {
  const allowed = ["businessName", "publicEmail", "phone", "whatsapp", "instagram", "location", "serviceArea", "description", "heroMode", "heroImageUrl", "logoUrl"];
  const data = Object.fromEntries(allowed.filter((key) => key in (req.body || {})).map((key) => [key, req.body[key] || null]));
  if (data.heroMode && !["DEFAULT", "IMAGE"].includes(data.heroMode)) return res.status(400).json({ message: "Hero mode must be DEFAULT or IMAGE." });
  if (data.heroMode === "IMAGE" && !data.heroImageUrl) return res.status(400).json({ message: "Choose a hero image before enabling image mode." });
  const profile = await prisma.businessProfile.upsert({ where: { id: 1 }, update: data, create: { ...DEFAULT_BUSINESS_PROFILE, ...data } });
  await recordActivity(prisma, req.user.id, "UPDATED", "BusinessProfile", 1, Object.keys(data));
  res.json(publicProfile(profile));
}));

router.post("/admin/uploads", asyncHandler(async (req, res) => {
  const url = await storeImage(req.body?.dataUrl, Boolean(req.body?.allowVideo));
  await recordActivity(prisma, req.user.id, "UPLOADED", "Image", url);
  res.status(201).json({ url });
}));

router.post("/admin/settings/restore-logo", asyncHandler(async (req, res) => {
  const profile = await prisma.businessProfile.upsert({ where: { id: 1 }, update: { logoUrl: DEFAULT_LOGO_URL }, create: DEFAULT_BUSINESS_PROFILE });
  await recordActivity(prisma, req.user.id, "RESTORED", "BusinessLogo", 1);
  res.json(publicProfile(profile));
}));

const taxonomyConfig = {
  categories: { model: "catalogueCategory", label: "Category" },
  styles: { model: "designStyle", label: "Design style" },
  "event-types": { model: "eventType", label: "Event type" }
};

router.get("/admin/taxonomies/:kind", asyncHandler(async (req, res) => {
  const config = taxonomyConfig[req.params.kind]; if (!config) return res.status(404).json({ message: "Unknown taxonomy." });
  res.json(await prisma[config.model].findMany({ orderBy: [{ displayOrder: "asc" }, { name: "asc" }] }));
}));
router.post("/admin/taxonomies/:kind", asyncHandler(async (req, res) => {
  const config = taxonomyConfig[req.params.kind]; if (!config) return res.status(404).json({ message: "Unknown taxonomy." });
  const name = req.body?.name?.trim(); const slug = uniqueSlug(name, config.label);
  const extras = config.model === "designStyle" ? { description: req.body?.description || null, imageUrl: req.body?.imageUrl || null } : config.model === "eventType" ? { imageUrl: req.body?.imageUrl || null } : {};
  const item = await prisma[config.model].create({ data: { name, slug, ...extras, displayOrder: Number(req.body?.displayOrder || 0), status: req.body?.status || "DRAFT" } });
  await recordActivity(prisma, req.user.id, "CREATED", config.label, item.id, { name }); res.status(201).json(item);
}));
router.put("/admin/taxonomies/:kind/:id", asyncHandler(async (req, res) => {
  const config = taxonomyConfig[req.params.kind]; if (!config) return res.status(404).json({ message: "Unknown taxonomy." });
  const id = Number(req.params.id); const name = req.body?.name?.trim();
  const allowed = config.model === "designStyle" ? ["name", "description", "imageUrl", "displayOrder", "status"] : config.model === "eventType" ? ["name", "imageUrl", "displayOrder", "status"] : ["name", "displayOrder", "status"];
  const data = Object.fromEntries(allowed.filter((key) => key in (req.body || {})).map((key) => [key, req.body[key]])); if (name) Object.assign(data, { name, slug: uniqueSlug(name, config.label) });
  const item = await prisma[config.model].update({ where: { id }, data }); await recordActivity(prisma, req.user.id, "UPDATED", config.label, id); res.json(item);
}));

router.get("/admin/designs", asyncHandler(async (_req, res) => res.json(await prisma.catalogueDesign.findMany({ orderBy: [{ displayOrder: "asc" }, { updatedAt: "desc" }], include: { category: true, eventType: true, designStyle: true, images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }] } } }))));
router.post("/admin/designs", asyncHandler(async (req, res) => {
  const body = req.body || {}; const name = body.name?.trim(); if (!name) return res.status(400).json({ message: "Design name is required." });
  const design = await prisma.catalogueDesign.create({ data: { publicId: makePublicId("EVD"), name, slug: `${uniqueSlug(name, "Design")}-${Date.now().toString(36)}`, description: body.description || null, categoryId: body.categoryId ? Number(body.categoryId) : null, eventTypeId: body.eventTypeId ? Number(body.eventTypeId) : null, designStyleId: body.designStyleId ? Number(body.designStyleId) : null, price: body.price === "" || body.price == null ? null : String(body.price), priceType: body.priceType || "ON_REQUEST", priceVisibility: body.priceVisibility || "HIDDEN", availability: body.availability || "AVAILABLE", status: body.status || "DRAFT", featured: Boolean(body.featured), displayOrder: Number(body.displayOrder || 0), createdById: req.user.id, updatedById: req.user.id } });
  await recordActivity(prisma, req.user.id, "CREATED", "CatalogueDesign", design.id, { name }); res.status(201).json(design);
}));
router.put("/admin/designs/:id", asyncHandler(async (req, res) => {
  const id = Number(req.params.id); const body = req.body || {}; const allowed = ["name", "description", "categoryId", "eventTypeId", "designStyleId", "price", "priceType", "priceVisibility", "availability", "status", "featured", "displayOrder"];
  const data = Object.fromEntries(allowed.filter((key) => key in body).map((key) => [key, ["categoryId", "eventTypeId", "designStyleId", "displayOrder"].includes(key) && body[key] !== null ? Number(body[key]) : key === "price" && body[key] !== null && body[key] !== "" ? String(body[key]) : body[key]])); data.updatedById = req.user.id;
  if (data.name) data.slug = `${uniqueSlug(data.name, "Design")}-${id}`;
  const design = await prisma.catalogueDesign.update({ where: { id }, data }); await recordActivity(prisma, req.user.id, "UPDATED", "CatalogueDesign", id); res.json(design);
}));
router.post("/admin/designs/:id/images", asyncHandler(async (req, res) => {
  const designId = Number(req.params.id); const url = req.body?.url; if (!url) return res.status(400).json({ message: "Image URL is required." });
  if (req.body?.isCover) await prisma.catalogueImage.updateMany({ where: { designId }, data: { isCover: false } });
  const image = await prisma.catalogueImage.create({ data: { designId, url, altText: req.body?.altText || null, sortOrder: Number(req.body?.sortOrder || 0), isCover: Boolean(req.body?.isCover) } }); await recordActivity(prisma, req.user.id, "ADDED_IMAGE", "CatalogueDesign", designId, { imageId: image.id }); res.status(201).json(image);
}));
router.put("/admin/design-images/:id", asyncHandler(async (req, res) => {
  const id = Number(req.params.id); const image = await prisma.catalogueImage.findUnique({ where: { id } }); if (!image) return res.status(404).json({ message: "Image not found." });
  if (req.body?.isCover) await prisma.catalogueImage.updateMany({ where: { designId: image.designId }, data: { isCover: false } });
  res.json(await prisma.catalogueImage.update({ where: { id }, data: { altText: req.body?.altText, sortOrder: req.body?.sortOrder === undefined ? undefined : Number(req.body.sortOrder), isCover: req.body?.isCover } }));
}));
router.delete("/admin/design-images/:id", asyncHandler(async (req, res) => { await prisma.catalogueImage.delete({ where: { id: Number(req.params.id) } }); await recordActivity(prisma, req.user.id, "REMOVED_IMAGE", "CatalogueImage", req.params.id); res.status(204).send(); }));

router.get("/admin/packages", asyncHandler(async (_req, res) => res.json(await prisma.eventPackage.findMany({ orderBy: [{ displayOrder: "asc" }, { updatedAt: "desc" }], include: { items: { include: { design: { select: { id: true, name: true, publicId: true } } } } } }))));
router.post("/admin/packages", asyncHandler(async (req, res) => {
  const body = req.body || {}; const name = body.name?.trim(); if (!name) return res.status(400).json({ message: "Package name is required." });
  const pkg = await prisma.eventPackage.create({ data: { publicId: makePublicId("EVP"), name, slug: `${uniqueSlug(name, "Package")}-${Date.now().toString(36)}`, description: body.description || null, price: body.price === "" || body.price == null ? null : String(body.price), priceType: body.priceType || "ON_REQUEST", priceVisibility: body.priceVisibility || "HIDDEN", availability: body.availability || "AVAILABLE", status: body.status || "DRAFT", featured: Boolean(body.featured), displayOrder: Number(body.displayOrder || 0), coverImageUrl: body.coverImageUrl || null, createdById: req.user.id, updatedById: req.user.id, items: { create: (body.designIds || []).map((designId, sortOrder) => ({ designId: Number(designId), sortOrder })) } } });
  await recordActivity(prisma, req.user.id, "CREATED", "EventPackage", pkg.id, { name }); res.status(201).json(pkg);
}));
router.put("/admin/packages/:id", asyncHandler(async (req, res) => {
  const id = Number(req.params.id); const body = req.body || {}; const allowed = ["name", "description", "price", "priceType", "priceVisibility", "availability", "status", "featured", "displayOrder", "coverImageUrl"];
  const data = Object.fromEntries(allowed.filter((key) => key in body).map((key) => [key, key === "price" && body[key] !== null && body[key] !== "" ? String(body[key]) : body[key]])); data.updatedById = req.user.id; if (data.name) data.slug = `${uniqueSlug(data.name, "Package")}-${id}`;
  if (Array.isArray(body.designIds)) data.items = { deleteMany: {}, create: body.designIds.map((designId, sortOrder) => ({ designId: Number(designId), sortOrder })) };
  const pkg = await prisma.eventPackage.update({ where: { id }, data }); await recordActivity(prisma, req.user.id, "UPDATED", "EventPackage", id); res.json(pkg);
}));

router.get("/admin/gallery", asyncHandler(async (_req, res) => res.json(await prisma.galleryItem.findMany({ orderBy: [{ displayOrder: "asc" }, { updatedAt: "desc" }] }))));
router.post("/admin/gallery", asyncHandler(async (req, res) => {
  const { title, imageUrl, caption, mediaType, category, eventTypeId, designStyleId, displayOrder, status, featured } = req.body || {}; if (!title?.trim() || !imageUrl) return res.status(400).json({ message: "Gallery title and media are required." });
  const item = await prisma.galleryItem.create({ data: { title: title.trim(), imageUrl, mediaType: mediaType || "IMAGE", category: category || "Other Events", caption: caption || null, eventTypeId: eventTypeId ? Number(eventTypeId) : null, designStyleId: designStyleId ? Number(designStyleId) : null, displayOrder: Number(displayOrder || 0), status: status || "DRAFT", featured: Boolean(featured) } }); await recordActivity(prisma, req.user.id, "CREATED", "GalleryItem", item.id); res.status(201).json(item);
}));
router.put("/admin/gallery/:id", asyncHandler(async (req, res) => { const id = Number(req.params.id); const data = { ...req.body }; delete data.id; delete data.createdAt; delete data.updatedAt; const item = await prisma.galleryItem.update({ where: { id }, data }); await recordActivity(prisma, req.user.id, "UPDATED", "GalleryItem", id); res.json(item); }));
router.delete("/admin/gallery/:id", asyncHandler(async (req, res) => { const id = Number(req.params.id); const item = await prisma.galleryItem.findUnique({ where: { id } }); if (!item) return res.status(404).json({ message: "Gallery item not found." }); await prisma.galleryItem.delete({ where: { id } }); await recordActivity(prisma, req.user.id, "DELETED", "GalleryItem", id, { imageUrl: item.imageUrl }); res.status(204).send(); }));

router.get("/admin/budget-ranges", asyncHandler(async (_req, res) => res.json(await prisma.budgetRange.findMany({ orderBy: { displayOrder: "asc" } }))));
router.post("/admin/budget-ranges", asyncHandler(async (req, res) => { const body = req.body || {}; if (!body.label?.trim()) return res.status(400).json({ message: "Budget label is required." }); const item = await prisma.budgetRange.create({ data: { label: body.label.trim(), minAmount: body.minAmount == null || body.minAmount === "" ? null : String(body.minAmount), maxAmount: body.maxAmount == null || body.maxAmount === "" ? null : String(body.maxAmount), displayOrder: Number(body.displayOrder || 0), status: body.status || "DRAFT" } }); await recordActivity(prisma, req.user.id, "CREATED", "BudgetRange", item.id); res.status(201).json(item); }));
router.put("/admin/budget-ranges/:id", asyncHandler(async (req, res) => { const body = req.body || {}; const item = await prisma.budgetRange.update({ where: { id: Number(req.params.id) }, data: { label: body.label?.trim(), minAmount: body.minAmount == null || body.minAmount === "" ? null : String(body.minAmount), maxAmount: body.maxAmount == null || body.maxAmount === "" ? null : String(body.maxAmount), displayOrder: body.displayOrder === undefined ? undefined : Number(body.displayOrder), status: body.status } }); await recordActivity(prisma, req.user.id, "UPDATED", "BudgetRange", item.id); res.json(item); }));

router.get("/admin/addons", asyncHandler(async (_req, res) => res.json(await prisma.approvedAddon.findMany({ orderBy: { displayOrder: "asc" } }))));
router.post("/admin/addons", asyncHandler(async (req, res) => { const body = req.body || {}; if (!body.name?.trim()) return res.status(400).json({ message: "Addon name is required." }); const item = await prisma.approvedAddon.create({ data: { name: body.name.trim(), description: body.description || null, price: body.price == null || body.price === "" ? null : String(body.price), displayOrder: Number(body.displayOrder || 0), status: body.status || "DRAFT" } }); await recordActivity(prisma, req.user.id, "CREATED", "ApprovedAddon", item.id); res.status(201).json(item); }));
router.put("/admin/addons/:id", asyncHandler(async (req, res) => { const body = req.body || {}; const item = await prisma.approvedAddon.update({ where: { id: Number(req.params.id) }, data: { name: body.name?.trim(), description: body.description, price: body.price == null || body.price === "" ? null : String(body.price), displayOrder: body.displayOrder === undefined ? undefined : Number(body.displayOrder), status: body.status } }); await recordActivity(prisma, req.user.id, "UPDATED", "ApprovedAddon", item.id); res.json(item); }));

router.get("/admin/enquiries", asyncHandler(async (_req, res) => res.json(await prisma.eventEnquiry.findMany({ orderBy: { createdAt: "desc" }, include: { eventType: true, selectedDesigns: true, selectedPackages: true, selectedAddons: true, attachments: true, quotations: true, customer: { select: { id: true, name: true, email: true } } } }))));
router.put("/admin/enquiries/:id", asyncHandler(async (req, res) => { const enquiry = await prisma.eventEnquiry.update({ where: { id: Number(req.params.id) }, data: { status: req.body?.status, adminNotes: req.body?.adminNotes } }); await recordActivity(prisma, req.user.id, "UPDATED", "EventEnquiry", enquiry.id, { status: enquiry.status }); res.json(enquiry); }));
router.get("/admin/quotations", asyncHandler(async (_req, res) => res.json(await prisma.quotation.findMany({ orderBy: { updatedAt: "desc" }, include: { enquiry: { select: { reference: true, fullName: true } }, history: { orderBy: { createdAt: "desc" } } } }))));
router.post("/admin/quotations", asyncHandler(async (req, res) => { const body = req.body || {}; const enquiry = await prisma.eventEnquiry.findUnique({ where: { id: Number(body.enquiryId) }, include: { selectedDesigns: true, selectedPackages: true, selectedAddons: true } }); if (!enquiry) return res.status(404).json({ message: "Enquiry not found." }); const snapshot = JSON.stringify({ enquiryId: enquiry.id, designs: enquiry.selectedDesigns, packages: enquiry.selectedPackages, addons: enquiry.selectedAddons, lineItems: body.lineItems || [], budgetRange: enquiry.budgetRange }); const quotation = await prisma.quotation.create({ data: { reference: makePublicId("EVT"), enquiryId: enquiry.id, status: body.status || "DRAFT", subtotal: body.subtotal == null ? null : String(body.subtotal), total: body.total == null ? null : String(body.total), notes: body.notes || null, snapshot, createdById: req.user.id, updatedById: req.user.id, history: { create: { changedById: req.user.id, action: "CREATED", snapshot } } }, include: { history: true } }); await recordActivity(prisma, req.user.id, "CREATED", "Quotation", quotation.id); res.status(201).json(quotation); }));
router.put("/admin/quotations/:id", asyncHandler(async (req, res) => { const id = Number(req.params.id); const previous = await prisma.quotation.findUnique({ where: { id } }); if (!previous) return res.status(404).json({ message: "Quotation not found." }); const body = req.body || {}; const snapshot = body.snapshot || previous.snapshot; const quotation = await prisma.quotation.update({ where: { id }, data: { status: body.status, subtotal: body.subtotal == null ? undefined : String(body.subtotal), total: body.total == null ? undefined : String(body.total), notes: body.notes, snapshot, updatedById: req.user.id, history: { create: { changedById: req.user.id, action: "UPDATED", snapshot } } }, include: { history: true } }); await recordActivity(prisma, req.user.id, "UPDATED", "Quotation", id); res.json(quotation); }));
router.get("/admin/activity", asyncHandler(async (_req, res) => res.json(await prisma.activityLog.findMany({ take: 100, orderBy: { createdAt: "desc" }, include: { user: { select: { name: true, email: true } } } }))));

export default router;
