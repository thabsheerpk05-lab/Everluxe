ALTER TABLE "ServiceProvider" ADD COLUMN "isMain" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Traveler" ADD COLUMN "serviceDirection" TEXT;

UPDATE "ServiceProvider"
SET "isMain" = true
WHERE lower(replace("providerName", ' ', '')) = 'wadinoor';
