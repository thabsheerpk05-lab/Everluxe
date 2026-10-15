import crypto from "crypto";

// Production tokens must survive individual serverless function invocations.
// Local development retains an ephemeral fallback so a missing local secret never
// becomes a static credential.
if (process.env.VERCEL && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be configured for Vercel deployments.");
}

export const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString("hex");
