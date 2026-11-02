const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const INSTAGRAM_EPOCH_MS = BigInt(Date.UTC(2011, 7, 24, 21, 7, 0));
const MIN_TIMESTAMP_MS = BigInt(Date.UTC(2010, 0, 1));
const MAX_TIMESTAMP_MS = BigInt(Date.now() + 86_400_000);

export function extractShortcode(value) {
  try {
    const url = new URL(String(value).trim());
    if (!["instagram.com", "www.instagram.com"].includes(url.hostname.toLowerCase())) {
      throw new Error("Not an Instagram URL");
    }
    const [kind, shortcode] = url.pathname.split("/").filter(Boolean);
    if (!["p", "reel", "reels", "tv"].includes(kind?.toLowerCase()) || !shortcode) {
      throw new Error("URL must contain a supported post or reel shortcode");
    }
    if (!/^[A-Za-z0-9_-]+$/.test(shortcode)) throw new Error("Invalid Instagram shortcode");
    return {
      shortcode,
      postType: kind.toLowerCase() === "p" ? "Post" : "Reel",
      normalizedUrl: `https://www.instagram.com/${kind.toLowerCase() === "reels" ? "reel" : kind.toLowerCase()}/${shortcode}/`
    };
  } catch (error) {
    throw new Error(error.message || "Invalid Instagram URL");
  }
}

export function shortcodeToMediaId(shortcode) {
  if (!shortcode || !/^[A-Za-z0-9_-]+$/.test(shortcode)) throw new Error("Invalid Instagram shortcode");
  let mediaId = 0n;
  for (const char of shortcode) {
    const value = ALPHABET.indexOf(char);
    if (value === -1) throw new Error("Invalid Instagram shortcode");
    mediaId = mediaId * 64n + BigInt(value);
  }
  return mediaId;
}

export function extractTimestamp(mediaId) {
  return BigInt(mediaId) >> 23n;
}

export function mediaIdToUnixMilliseconds(mediaId) {
  return INSTAGRAM_EPOCH_MS + extractTimestamp(mediaId);
}

export function formatTimestamp(timestamp, timezone = "Asia/Kolkata") {
  const milliseconds = BigInt(timestamp);
  if (milliseconds < MIN_TIMESTAMP_MS || milliseconds > MAX_TIMESTAMP_MS) return null;
  const date = new Date(Number(milliseconds));
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).format(date).replace(",", "").split(/[\s,]+/);
  const [datePart, timePart] = parts;
  return {
    utc: date.toISOString(),
    ist: `${datePart} ${timePart}`,
    date: datePart,
    time: timePart
  };
}

export function analyzeInstagramUrl(value) {
  const originalUrl = String(value ?? "").trim();
  try {
    const parsed = extractShortcode(originalUrl);
    const mediaId = shortcodeToMediaId(parsed.shortcode);
    const timestamp = mediaIdToUnixMilliseconds(mediaId);
    const formatted = formatTimestamp(timestamp);
    if (!formatted) {
      return {
        originalUrl, ...parsed, mediaId: mediaId.toString(), timestampSource: "calculated_from_media_id",
        status: "failed", error: "Calculated timestamp is outside the supported date range"
      };
    }
    return {
      originalUrl, ...parsed, mediaId: mediaId.toString(), creationTimestamp: formatted.utc,
      publishingDateIST: formatted.date, publishingTimeIST: formatted.time, utcTimestamp: formatted.utc,
      timestampSource: "calculated_from_media_id", status: "success", error: null
    };
  } catch (error) {
    return { originalUrl, status: "failed", timestampSource: "calculated_from_media_id", error: error.message };
  }
}

export { ALPHABET, INSTAGRAM_EPOCH_MS };
