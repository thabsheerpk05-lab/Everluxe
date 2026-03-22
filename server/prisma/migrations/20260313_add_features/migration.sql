PRAGMA foreign_keys=OFF;

-- Create new tables
CREATE TABLE "Driver" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "driverName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL
);

CREATE TABLE "Ameer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "notes" TEXT
);

CREATE TABLE "ServiceProvider" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "providerName" TEXT NOT NULL
);

-- Redefine Trip with driver and ameer
CREATE TABLE "new_Trip" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "packageId" INTEGER NOT NULL,
    "tripDate" DATETIME NOT NULL,
    "seasonalPrice" REAL NOT NULL,
    "notes" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "driverId" INTEGER,
    "ameerId" INTEGER,
    CONSTRAINT "Trip_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Trip_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Trip_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Trip_ameerId_fkey" FOREIGN KEY ("ameerId") REFERENCES "Ameer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Trip" ("id", "packageId", "tripDate", "seasonalPrice", "notes", "createdById", "createdAt")
SELECT "id", "packageId", "tripDate", "seasonalPrice", "notes", "createdById", "createdAt" FROM "Trip";

DROP TABLE "Trip";
ALTER TABLE "new_Trip" RENAME TO "Trip";

-- Redefine Traveler with status and payment fields
CREATE TABLE "new_Traveler" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "travelerName" TEXT NOT NULL,
    "passportOrIqama" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "travelerType" TEXT NOT NULL,
    "tripId" INTEGER NOT NULL,
    "paymentAmount" REAL NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'Cash',
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "extraRoomCharge" REAL NOT NULL DEFAULT 0,
    "discountAmount" REAL NOT NULL DEFAULT 0,
    "finalAmount" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "serviceProviderId" INTEGER,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Traveler_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Traveler_serviceProviderId_fkey" FOREIGN KEY ("serviceProviderId") REFERENCES "ServiceProvider" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Traveler_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Traveler" ("id", "travelerName", "passportOrIqama", "phoneNumber", "travelerType", "tripId", "paymentAmount", "paymentMethod", "createdAt")
SELECT "id", "travelerName", "passportOrIqama", "phoneNumber", "travelerType", "tripId", "paymentAmount", "paymentMethod", "createdAt" FROM "Traveler";

DROP TABLE "Traveler";
ALTER TABLE "new_Traveler" RENAME TO "Traveler";

PRAGMA foreign_keys=ON;
