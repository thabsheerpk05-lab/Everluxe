import { Prisma } from "@prisma/client";

const DATABASE_CODES = new Set([
  "P1000", "P1001", "P1002", "P1008", "P1010", "P1011", "P1017",
  "P2021", "P2022", "P2023", "P2024", "P2025", "P2034"
]);

export function classifyError(error) {
  if (error?.type === "entity.too.large" || error?.statusCode === 413) return { category: "validation", status: 413, code: null, message: "The uploaded file is too large." };
  if (error?.statusCode === 400) return { category: "validation", status: 400, code: null, message: error.message || "The request data is invalid." };
  if (error?.statusCode === 503) return { category: "storage", status: 503, code: null, message: error.message || "The requested storage service is unavailable." };
  if (error instanceof Prisma.PrismaClientValidationError) {
    const detail = process.env.NODE_ENV === "production" ? "The request data is invalid." : `The request data is invalid: ${error.message.split("\n").slice(-1)[0].trim()}`;
    return { category: "validation", status: 400, code: null, message: detail };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const databaseFailure = DATABASE_CODES.has(error.code);
    return {
      category: databaseFailure ? "database" : "prisma",
      status: databaseFailure ? 503 : 500,
      code: error.code,
      message: databaseFailure ? "The database request could not be completed." : "The database request failed."
    };
  }
  if (error instanceof Prisma.PrismaClientInitializationError || error instanceof Prisma.PrismaClientRustPanicError) {
    return { category: "database", status: 503, code: null, message: "The database is temporarily unavailable." };
  }
  return { category: "unexpected", status: 500, code: null, message: "Internal server error." };
}

export function logApiError(error, req) {
  const details = classifyError(error);
  // Deliberately log only safe metadata. Error messages can contain connection details.
  console.error("[api-error]", JSON.stringify({
    method: req.method,
    endpoint: req.originalUrl,
    category: details.category,
    prismaCode: details.code
  }));
  return details;
}
