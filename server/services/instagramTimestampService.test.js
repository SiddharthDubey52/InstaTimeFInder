import assert from "node:assert/strict";
import test from "node:test";
import {
  extractShortcode, shortcodeToMediaId, extractTimestamp,
  mediaIdToUnixMilliseconds, formatTimestamp, analyzeInstagramUrl
} from "./instagramTimestampService.js";

test("extracts post and reel shortcodes", () => {
  assert.deepEqual(extractShortcode("https://www.instagram.com/p/ABC123/?x=1").shortcode, "ABC123");
  assert.equal(extractShortcode("https://instagram.com/reels/ABC123/").postType, "Reel");
});

test("converts shortcode with BigInt", () => {
  assert.equal(shortcodeToMediaId("ABC123").toString(), "17522103");
  assert.equal(extractTimestamp(1n << 23n).toString(), "1");
});

test("uses the configured Instagram epoch", () => {
  const mediaId = 0n;
  assert.equal(mediaIdToUnixMilliseconds(mediaId).toString(), "1314220020000");
});

test("formats valid UTC and IST timestamps", () => {
  const formatted = formatTimestamp(BigInt(Date.UTC(2026, 10, 2, 15, 0, 0)));
  assert.equal(formatted.utc, "2026-11-02T15:00:00.000Z");
  assert.match(formatted.ist, /2026-11-02 20:30:00/);
});

test("returns independent invalid URL results", () => {
  assert.equal(analyzeInstagramUrl("https://example.com/p/ABC").status, "failed");
  assert.equal(analyzeInstagramUrl("https://instagram.com/p/not valid").status, "failed");
});
