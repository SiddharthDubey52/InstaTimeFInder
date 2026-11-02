import assert from "node:assert/strict";
import test from "node:test";
import { parseYouTubeUrl } from "./youtubeMetadata.js";

test("parses supported YouTube URL formats", () => {
  assert.equal(parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ").videoType, "Video");
  assert.equal(parseYouTubeUrl("https://youtu.be/dQw4w9WgXcQ").videoId, "dQw4w9WgXcQ");
  assert.equal(parseYouTubeUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ").videoType, "Short");
  assert.equal(parseYouTubeUrl("https://www.youtube.com/embed/dQw4w9WgXcQ").videoType, "Video");
});

test("rejects malformed or unsupported YouTube URLs", () => {
  assert.equal(parseYouTubeUrl("https://example.com/watch?v=dQw4w9WgXcQ").valid, false);
  assert.equal(parseYouTubeUrl("https://www.youtube.com/watch?v=bad").valid, false);
});
