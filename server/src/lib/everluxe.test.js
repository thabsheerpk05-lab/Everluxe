import test from "node:test";
import assert from "node:assert/strict";
import { parseBuffer, parseDataUrl } from "./everluxe.js";

test("accepts supported image and video media types within their limits", () => {
  assert.equal(parseBuffer(Buffer.from("image"), "image/jpeg").extension, "jpg");
  assert.equal(parseBuffer(Buffer.from("video"), "video/mp4", true).extension, "mp4");
});

test("rejects video uploads when the route does not allow video", () => {
  assert.throws(() => parseBuffer(Buffer.from("video"), "video/mp4"), /Upload a PNG/);
});

test("rejects unsupported data URLs", () => {
  assert.throws(() => parseDataUrl("data:text/plain;base64,SGk="), /Upload a PNG/);
});
