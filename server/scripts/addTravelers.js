import "dotenv/config";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: new URL("../prisma/.env", import.meta.url).pathname });

const prisma = new PrismaClient();

const firstNames = ["Hassan", "Aisha", "Khalid", "Noor", "Salim", "Ibrahim", "Sara", "Fatima", "Omar", "Yasmin"];
const lastNames = ["Ali", "Rahman", "Noor", "Khan", "Ahmed", "Qureshi", "Hadi", "Farooq", "Saad", "Nazar"];
const paymentStatuses = ["PAID", "PARTIAL", "UNPAID"];
const travelerTypes = ["BACHELOR", "FAMILY"];

function pick(list, index) {
  return list[index % list.length];
}

function buildPhone(index) {
  return `05${String(10000000 + index).slice(0, 8)}`;
}

function buildPassport(index) {
  return `P${String(1000000 + index)}`;
}

async function main() {
  const [trips, providers, users] = await Promise.all([
    prisma.trip.findMany({ include: { package: true } }),
    prisma.serviceProvider.findMany(),
    prisma.user.findMany()
  ]);

  if (!trips.length) {
    console.log("No trips found. Nothing to create.");
    return;
  }

  const provider =
    providers.find((p) => p.providerName.toLowerCase() === "wadinoor") ||
    providers[0];
  const creator = users.find((u) => u.role === "ADMIN") || users[0];

  if (!provider || !creator) {
    console.log("Missing provider or user to assign travelers. Aborting.");
    return;
  }

  let createdTotal = 0;

  for (const trip of trips) {
    const existingCount = await prisma.traveler.count({ where: { tripId: trip.id } });
    const toCreate = Math.max(0, 5 - existingCount);
    if (toCreate === 0) continue;

    const base = Number(trip.seasonalPrice || 0);
    const rows = Array.from({ length: toCreate }, (_, idx) => {
      const seed = trip.id * 100 + idx + existingCount;
      const travelerType = pick(travelerTypes, seed);
      const extraRoomCharge = travelerType === "FAMILY" ? 100 : 0;
      const customPrice = seed % 3 === 0 ? 50 : 0;
      const amountPaid = base;
      const finalAmount = Math.max(amountPaid + extraRoomCharge - customPrice, 0);

      return {
        travelerName: `${pick(firstNames, seed)} ${pick(lastNames, seed + 3)}`,
        passportOrIqama: buildPassport(seed),
        phoneNumber: travelerType === "BACHELOR" ? buildPhone(seed) : "",
        travelerType,
        tripId: trip.id,
        amountPaid,
        paymentStatus: pick(paymentStatuses, seed),
        extraRoomCharge,
        customPrice,
        finalAmount,
        status: "ACTIVE",
        serviceProviderId: provider.id,
        createdById: creator.id
      };
    });

    await prisma.traveler.createMany({ data: rows });
    createdTotal += rows.length;
    console.log(`Trip ${trip.id}: created ${rows.length} travelers (now ${existingCount + rows.length}).`);
  }

  console.log(`Done. Total travelers created: ${createdTotal}.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

