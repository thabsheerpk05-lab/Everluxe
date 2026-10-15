import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const items = (names) => names.map((name, displayOrder) => ({ name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""), displayOrder, status: "PUBLISHED" }));

async function main() {
  await prisma.businessProfile.upsert({
    where: { id: 1 }, update: {}, create: {
      id: 1, businessName: "EVERLUXE EVENTS", publicEmail: "everluxeevents123@gmail.com", phone: "+91 97452 27257", whatsapp: "+91 97452 27257",
      instagram: "ever.luxe_events", location: "Nilambur, Malappuram, Kerala, India", serviceArea: "Across Kerala",
      description: "Elegant stages, entrances and event spaces designed to make special moments unforgettable.", heroMode: "DEFAULT", logoUrl: "/brand/everluxe-logo.png"
    }
  });
  for (const category of items(["Stage", "Entrance", "Reception", "Backdrop", "Lighting", "Decorative Elements", "Full Event Setup", "Other"])) {
    await prisma.catalogueCategory.upsert({ where: { slug: category.slug }, update: { name: category.name, displayOrder: category.displayOrder, status: "PUBLISHED" }, create: category });
  }
  for (const style of items(["Minimal", "Elegant", "Contemporary", "Grand", "Luxury", "Bespoke"])) {
    await prisma.designStyle.upsert({ where: { slug: style.slug }, update: { name: style.name, displayOrder: style.displayOrder, status: "PUBLISHED" }, create: style });
  }
  for (const eventType of items(["Weddings", "Engagements", "Nikah", "Receptions", "Birthdays", "Corporate Events", "Other Events"])) {
    await prisma.eventType.upsert({ where: { slug: eventType.slug }, update: { name: eventType.name, displayOrder: eventType.displayOrder, status: "PUBLISHED" }, create: eventType });
  }
  const email = process.env.INITIAL_ADMIN_EMAIL;
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (email && password) {
    await prisma.user.upsert({ where: { email }, update: { role: "ADMIN" }, create: { name: "Everluxe Admin", email, password: await bcrypt.hash(password, 12), role: "ADMIN", permissions: "{}" } });
  }
}

main().then(() => prisma.$disconnect()).catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
