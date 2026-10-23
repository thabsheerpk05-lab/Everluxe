import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../lib/security.js";

export function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    console.warn("[api-auth]", JSON.stringify({ method: req.method, endpoint: req.originalUrl, category: "authentication", status: 401 }));
    return res.status(401).json({ message: "Missing authentication token" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (error) {
    console.warn("[api-auth]", JSON.stringify({ method: req.method, endpoint: req.originalUrl, category: "authentication", status: 401 }));
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "ADMIN") {
    console.warn("[api-auth]", JSON.stringify({ method: req.method, endpoint: req.originalUrl, category: "authorization", status: 403 }));
    return res.status(403).json({ message: "Admin access required" });
  }
  return next();
}
