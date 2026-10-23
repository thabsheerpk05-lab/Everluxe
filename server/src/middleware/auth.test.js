import test from "node:test";
import assert from "node:assert/strict";
import { requireAdmin } from "./auth.js";

function response() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test("rejects non-admin users with 403", () => {
  const res = response();
  requireAdmin({ user: { role: "CUSTOMER" } }, res, () => assert.fail("next should not be called"));
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { message: "Admin access required" });
});

test("allows admin users", () => {
  const res = response();
  let called = false;
  requireAdmin({ user: { role: "ADMIN" } }, res, () => { called = true; });
  assert.equal(called, true);
});
