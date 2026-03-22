PRAGMA foreign_keys=OFF;

-- Add permissions to User
ALTER TABLE "User" ADD COLUMN "permissions" TEXT NOT NULL DEFAULT '{}';

-- Add passport numbers to Driver and Ameer
ALTER TABLE "Driver" ADD COLUMN "passportNumber" TEXT;
ALTER TABLE "Ameer" ADD COLUMN "passportNumber" TEXT;

-- Create TripCollection table
CREATE TABLE "TripCollection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tripId" INTEGER NOT NULL,
    "ameerId" INTEGER NOT NULL,
    "amountReceived" REAL NOT NULL,
    "date" DATETIME NOT NULL,
    "receivedByAdminId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TripCollection_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TripCollection_ameerId_fkey" FOREIGN KEY ("ameerId") REFERENCES "Ameer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TripCollection_receivedByAdminId_fkey" FOREIGN KEY ("receivedByAdminId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

PRAGMA foreign_keys=ON;
