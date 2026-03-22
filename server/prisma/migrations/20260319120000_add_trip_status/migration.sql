-- Add status field to Trip
ALTER TABLE "Trip" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'OPEN';
