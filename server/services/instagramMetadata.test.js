import assert from "node:assert/strict";
import test from "node:test";
import { cleanPageName, pageNameFromExplicitTitle } from "./instagramMetadata.js";

test("extracts only an explicit Instagram account title", () => {
  assert.equal(
    pageNameFromExplicitTitle('Reality Scoop on Instagram: "A post caption with: punctuation"'),
    "Reality Scoop"
  );
  assert.equal(pageNameFromExplicitTitle("A post caption without an account marker"), null);
});

test("cleans HTML entities and whitespace without changing account punctuation", () => {
  assert.equal(cleanPageName("  News &amp; Views  "), "News & Views");
  assert.equal(cleanPageName("Reality Scoop on Instagram:"), "Reality Scoop");
});
