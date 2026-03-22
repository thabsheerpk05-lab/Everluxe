import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("admin123", 10);
  const staffPassword = await bcrypt.hash("staff123", 10);

  const adminPermissions = {
    can_view_trips: true,
    can_view_packages: true,
    can_view_travelers: true,
    can_edit_travelers: true,
    can_view_expenses: true,
    can_edit_expenses: true,
    can_view_reports: true,
    can_manage_payments: true,
    is_ameer: false
  };

  const staffPermissions = {
    can_view_trips: true,
    can_view_packages: true,
    can_view_travelers: true,
    can_edit_travelers: true,
    can_view_expenses: true,
    can_edit_expenses: true,
    can_view_reports: true,
    can_manage_payments: true,
    is_ameer: false
  };

  const admin = await prisma.user.upsert({
    where: { email: "admin@wadi-noor.com" },
    update: { permissions: JSON.stringify(adminPermissions) },
    create: {
      name: "Admin User",
      email: "admin@wadi-noor.com",
      password: adminPassword,
      role: "ADMIN",
      permissions: JSON.stringify(adminPermissions)
    }
  });

  const staff = await prisma.user.upsert({
    where: { email: "staff@wadi-noor.com" },
    update: { permissions: JSON.stringify(staffPermissions) },
    create: {
      name: "Staff User",
      email: "staff@wadi-noor.com",
      password: staffPassword,
      role: "STAFF",
      permissions: JSON.stringify(staffPermissions)
    }
  });

  const wadinoor = await prisma.serviceProvider.upsert({
    where: { id: 1 },
    update: { providerName: "Wadinoor" },
    create: { providerName: "Wadinoor" }
  });

  const otherProvider = await prisma.serviceProvider.create({
    data: { providerName: "Al Noor Travels" }
  });

  const driver1 = await prisma.driver.create({
    data: { driverName: "Salim Khan", phoneNumber: "0551112233", passportNumber: "D-998877" }
  });

  const driver2 = await prisma.driver.create({
    data: { driverName: "Faisal Ahmed", phoneNumber: "0554445566", passportNumber: "D-776655" }
  });

  const ameer1 = await prisma.ameer.create({
    data: { name: "Ibrahim Noor", phone: "0509998877", passportNumber: "A-112233", notes: "Senior guide" }
  });

  const ameer2 = await prisma.ameer.create({
    data: { name: "Sami Rahman", phone: "0502223344", passportNumber: "A-445566", notes: "New group leader" }
  });

  const pkg1 = await prisma.package.create({
    data: {
      packageName: "Makkah Express",
      route: "Jeddah - Makkah - Madinah",
      durationDays: 7,
      departureDay: "Thursday",
      departureTime: "06:00"
    }
  });

  const pkg2 = await prisma.package.create({
    data: {
      packageName: "Noor Family Special",
      route: "Riyadh - Makkah - Madinah",
      durationDays: 10,
      departureDay: "Saturday",
      departureTime: "05:30"
    }
  });

  const trip1 = await prisma.trip.create({
    data: {
      packageId: pkg1.id,
      tripDate: new Date(),
      seasonalPrice: 1450,
      notes: "Ramadan special",
      createdById: admin.id,
      driverId: driver1.id,
      ameerId: ameer1.id
    }
  });

  const trip2 = await prisma.trip.create({
    data: {
      packageId: pkg2.id,
      tripDate: new Date(new Date().setDate(new Date().getDate() + 10)),
      seasonalPrice: 1700,
      notes: "Family focused package",
      createdById: admin.id,
      driverId: driver2.id,
      ameerId: ameer2.id
    }
  });

  await prisma.traveler.createMany({
    data: [
      {
        travelerName: "Hassan Ali",
        passportOrIqama: "P1234567",
        phoneNumber: "0501234567",
        travelerType: "BACHELOR",
        tripId: trip1.id,
        amountPaid: 1450,
        paymentStatus: "PAID",
        extraRoomCharge: 0,
        customPrice: 0,
        finalAmount: 1450,
        status: "ACTIVE",
        serviceProviderId: wadinoor.id,
        createdById: staff.id
      },
      {
        travelerName: "Aisha Rahman",
        passportOrIqama: "I9988776",
        phoneNumber: "",
        travelerType: "FAMILY",
        tripId: trip1.id,
        amountPaid: 1000,
        paymentStatus: "PARTIAL",
        extraRoomCharge: 150,
        customPrice: 0,
        finalAmount: 1600,
        status: "ACTIVE",
        serviceProviderId: otherProvider.id,
        createdById: staff.id
      },
      {
        travelerName: "Khalid Noor",
        passportOrIqama: "P2233445",
        phoneNumber: "0569988776",
        travelerType: "FAMILY",
        tripId: trip2.id,
        amountPaid: 0,
        paymentStatus: "UNPAID",
        extraRoomCharge: 0,
        customPrice: 50,
        finalAmount: 1650,
        status: "ACTIVE",
        serviceProviderId: wadinoor.id,
        createdById: admin.id
      }
    ]
  });

  await prisma.expense.createMany({
    data: [
      {
        date: new Date(),
        category: "BUS",
        description: "Bus rental for Makkah transfer",
        amount: 2200,
        createdById: staff.id
      },
      {
        date: new Date(),
        category: "ROOM",
        description: "Hotel booking advance",
        amount: 4800,
        createdById: admin.id
      },
      {
        date: new Date(),
        category: "MEAL",
        description: "Group meal arrangements",
        amount: 900,
        createdById: staff.id
      }
    ]
  });

  await prisma.tripCollection.create({
    data: {
      tripId: trip1.id,
      ameerId: ameer1.id,
      amountReceived: 5000,
      date: new Date(),
      receivedByAdminId: admin.id
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
