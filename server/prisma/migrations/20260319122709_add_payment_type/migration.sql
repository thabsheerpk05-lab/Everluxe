-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Traveler" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "travelerName" TEXT NOT NULL,
    "passportOrIqama" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "travelerType" TEXT NOT NULL,
    "familyCount" INTEGER NOT NULL DEFAULT 1,
    "coPassengers" TEXT,
    "tripId" INTEGER NOT NULL,
    "paymentAmount" REAL NOT NULL DEFAULT 0,
    "paymentType" TEXT,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "paymentMethod" TEXT NOT NULL DEFAULT 'Cash',
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
INSERT INTO "new_Traveler" ("coPassengers", "createdAt", "createdById", "discountAmount", "extraRoomCharge", "familyCount", "finalAmount", "id", "passportOrIqama", "paymentAmount", "paymentMethod", "paymentStatus", "phoneNumber", "serviceProviderId", "status", "travelerName", "travelerType", "tripId") SELECT "coPassengers", "createdAt", "createdById", "discountAmount", "extraRoomCharge", "familyCount", "finalAmount", "id", "passportOrIqama", "paymentAmount", "paymentMethod", "paymentStatus", "phoneNumber", "serviceProviderId", "status", "travelerName", "travelerType", "tripId" FROM "Traveler";
DROP TABLE "Traveler";
ALTER TABLE "new_Traveler" RENAME TO "Traveler";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
