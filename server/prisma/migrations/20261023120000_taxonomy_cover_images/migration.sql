-- Allow each public taxonomy item to carry an optional cover image.
ALTER TABLE "CatalogueCategory" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
