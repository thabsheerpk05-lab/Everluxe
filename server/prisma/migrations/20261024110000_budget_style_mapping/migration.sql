ALTER TABLE "BudgetRange" ADD COLUMN IF NOT EXISTS "styleId" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BudgetRange_styleId_fkey'
  ) THEN
    ALTER TABLE "BudgetRange"
      ADD CONSTRAINT "BudgetRange_styleId_fkey"
      FOREIGN KEY ("styleId") REFERENCES "DesignStyle"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "BudgetRange_styleId_idx" ON "BudgetRange"("styleId");
