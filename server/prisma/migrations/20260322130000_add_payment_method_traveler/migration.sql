-- Add paymentMethod to Traveler
ALTER TABLE "Traveler" ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'Cash';
