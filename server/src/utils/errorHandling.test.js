import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { classifyError } from "./errorHandling.js";
import { publishedWhere } from "./publicContent.js";
import { allSelectionsPublished, normalizeSelectionIds } from "./enquirySelection.js";

test("classifies missing-table Prisma failures as database errors", () => {
  const error = new Prisma.PrismaClientKnownRequestError("table missing", { code: "P2021", clientVersion: "5.22.0" });
  assert.deepEqual(classifyError(error), {
    category: "database",
    status: 503,
    code: "P2021",
    message: "The database request could not be completed."
  });
});

test("classifies Prisma validation failures as client errors", () => {
  const error = new Prisma.PrismaClientValidationError("invalid query", { clientVersion: "5.22.0" });
  assert.equal(classifyError(error).category, "validation");
  assert.equal(classifyError(error).status, 400);
});

test("does not expose unexpected error details", () => {
  const details = classifyError(new Error("postgresql://secret:password@example.invalid/db"));
  assert.deepEqual(details, { category: "unexpected", status: 500, code: null, message: "Internal server error." });
});

test("public content filters to published records only", () => {
  assert.deepEqual(publishedWhere({ featured: true }), { featured: true, status: "PUBLISHED" });
});

test("normalizes duplicate model selections and rejects unavailable references", () => {
  assert.deepEqual(normalizeSelectionIds([3, "3", 8], [8, "bad"]), [3, 8]);
  assert.equal(allSelectionsPublished([3], [{ id: 3, status: "PUBLISHED", availability: "AVAILABLE" }]), true);
  assert.equal(allSelectionsPublished([3], [{ id: 3, status: "DRAFT", availability: "AVAILABLE" }]), false);
});
