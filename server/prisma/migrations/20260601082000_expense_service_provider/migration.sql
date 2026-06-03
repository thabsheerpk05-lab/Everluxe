ALTER TABLE "Expense" ADD COLUMN "serviceProviderId" INTEGER;

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_serviceProviderId_fkey"
FOREIGN KEY ("serviceProviderId") REFERENCES "ServiceProvider"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
