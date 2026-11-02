const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com"]);
import { analyzeInstagramUrl, shortcodeToMediaId } from "../services/instagramTimestampService.js";

export function parseInstagramUrl(value) {
  try {
    const url = new URL(String(value).trim());
    const host = url.hostname.toLowerCase();
    if (!INSTAGRAM_HOSTS.has(host)) return { valid: false, error: "Not an Instagram URL" };

    const segments = url.pathname.split("/").filter(Boolean);
    const typeSegment = segments[0]?.toLowerCase();
    if (!["p", "reel", "reels", "tv"].includes(typeSegment) || !segments[1]) {
      return { valid: false, error: "URL must contain a supported post or reel shortcode" };
    }

    const shortcode = segments[1];
    if (!/^[A-Za-z0-9_-]+$/.test(shortcode)) {
      return { valid: false, error: "Invalid Instagram shortcode" };
    }

    return {
      valid: true,
      url: `https://www.instagram.com/${typeSegment === "reels" ? "reel" : typeSegment}/${shortcode}/`,
      shortcode,
      type: typeSegment === "p" ? "Post" : "Reel"
    };
  } catch {
    return { valid: false, error: "Invalid URL" };
  }
}

// Instagram shortcodes are base64-like encodings of media IDs, not timestamps.
export function decodeMediaId(shortcode) {
  try {
    return shortcodeToMediaId(shortcode).toString();
  } catch {
    return null;
  }
}

export function resultFromUrl(rawUrl) {
  const analyzed = analyzeInstagramUrl(rawUrl);
  const parsed = parseInstagramUrl(rawUrl);
  return {
    ...analyzed,
    normalizedUrl: analyzed.normalizedUrl || String(rawUrl ?? "").trim(),
    postType: analyzed.postType || parsed.type,
    publishedAtUtc: analyzed.utcTimestamp,
    publishedAtIst: analyzed.publishingDateIST && analyzed.publishingTimeIST
      ? `${analyzed.publishingDateIST} ${analyzed.publishingTimeIST}`
      : undefined,
    publishingDate: analyzed.publishingDateIST,
    publishingTimeIst: analyzed.publishingTimeIST,
    username: null,
    pageName: "Not Available",
    status: analyzed.status === "success" ? "pending" : analyzed.status,
    timestampSource: analyzed.timestampSource,
    error: analyzed.error || null
  };
}
