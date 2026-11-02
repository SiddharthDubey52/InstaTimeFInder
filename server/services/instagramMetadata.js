import { resultFromUrl } from "../utils/instagram.js";

const requestHeaders = {
  "User-Agent": "Mozilla/5.0 (compatible; InstagramTimeFinder/1.0)"
};

function findMeta(html, property, name) {
  const escaped = property || name;
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)[^>]+(?:property|name)=["']${escaped}["']`, "i")
  ];
  return patterns.map((pattern) => html.match(pattern)?.[1]).find(Boolean) || null;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function findJsonLd(html) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    try {
      const value = JSON.parse(match[1].trim());
      const item = Array.isArray(value) ? value.find((entry) => entry.datePublished || entry.author) : value;
      if (item) return item;
    } catch {
      // Instagram may include non-JSON script contents; continue with other metadata.
    }
  }
  return null;
}

function findUnixTimestamp(html) {
  const match = html.match(/(?:taken_at_timestamp|taken_at|datePublished|published_time)["\\']?\s*[:=]\s*["\\']?(\d{10})/i);
  if (!match) return null;
  const date = new Date(Number(match[1]) * 1000);
  return date.valueOf() > Date.UTC(2010, 0, 1) && date.valueOf() <= Date.now() + 86_400_000 ? date : null;
}

export function cleanPageName(value) {
  return decodeHtmlEntities(String(value || "")
    .replace(/\s+on\s+Instagram\s*:?\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim());
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([a-f\d]+);/gi, (_match, code) => String.fromCodePoint(parseInt(code, 16)));
}

function accountMetadata(html) {
  const fields = [
    /"full_name"\s*:\s*"((?:\\.|[^"\\])*)"/i,
    /"owner"\s*:\s*\{[\s\S]{0,1200}?"full_name"\s*:\s*"((?:\\.|[^"\\])*)"/i,
    /"profile_name"\s*:\s*"((?:\\.|[^"\\])*)"/i
  ];
  for (const field of fields) {
    const match = html.match(field);
    if (match?.[1]) {
      try {
        const name = cleanPageName(JSON.parse(`"${match[1]}"`));
        if (name) return name;
      } catch {
        const name = cleanPageName(match[1].replace(/\\"/g, '"'));
        if (name) return name;
      }
    }
  }
  return null;
}

export function pageNameFromExplicitTitle(value) {
  const title = decodeHtmlEntities(String(value || "")).replace(/\s+/g, " ").trim();
  const match = title.match(/^(.+?)\s+on\s+Instagram\s*:\s*(?:"[^"]*"|'[^']*'|“[^”]*”|‘[^’]*’|\S.*)?$/i);
  return match?.[1] ? cleanPageName(match[1]) : null;
}

function setTimestamp(result, date, source) {
  result.publishedAtUtc = date.toISOString();
  result.publishedAtIst = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).format(date).replace(",", "");
  result.publishingDate = result.publishedAtIst.slice(0, 10);
  result.publishingTimeIst = result.publishedAtIst.slice(11);
  result.timestampSource = source;
}

export async function processInstagramUrl(rawUrl) {
  const result = resultFromUrl(rawUrl);
  if (result.status === "failed") return result;

  try {
    const response = await fetchWithTimeout(result.normalizedUrl, {
      headers: requestHeaders,
      redirect: "follow"
    });
    if (!response.ok) throw new Error(`Instagram returned HTTP ${response.status}`);
    const html = await response.text();
    const jsonLd = findJsonLd(html);
    const published = jsonLd?.datePublished || findMeta(html, "article:published_time") || findMeta(html, "og:updated_time");
    const author = typeof jsonLd?.author === "object" ? jsonLd.author.name : jsonLd?.author;
    const accountName = accountMetadata(html);
    const titleAuthor = pageNameFromExplicitTitle(findMeta(html, "og:title"));
    const usernameMatch = html.match(/"username":"([^"]+)"/);

    if (published) {
      const date = new Date(published);
      if (!Number.isNaN(date.valueOf())) {
        setTimestamp(result, date, "Instagram metadata");
      }
    }
    if (!result.publishedAtIst) {
      try {
        const embed = await fetchWithTimeout(`${result.normalizedUrl}embed/captioned/`, { headers: requestHeaders });
        if (embed.ok) {
          const embedTimestamp = findUnixTimestamp(await embed.text());
          if (embedTimestamp) setTimestamp(result, embedTimestamp, "Instagram embed metadata");
        }
      } catch {
        // The embed endpoint is an optional public metadata source.
      }
    }
    result.username = usernameMatch?.[1] ? `@${usernameMatch[1]}` : null;
    result.pageName = accountName || cleanPageName(author) || titleAuthor || "Not Available";

    if (!result.username && result.pageName === "Not Available") {
      try {
        const oembed = await fetchWithTimeout(
          `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(result.normalizedUrl)}`,
          { headers: requestHeaders }
        );
        if (oembed.ok) {
          const data = await oembed.json();
          result.username = data.author_name ? `@${data.author_name}` : null;
        }
      } catch {
        // Public oEmbed is optional and may be unavailable without changing the result.
      }
    }

    result.status = result.publishedAtIst || result.username || result.pageName !== "Not Available"
      ? "success"
      : "partial";
    return result;
  } catch (error) {
    return {
      ...result,
      status: "failed",
      error: "Metadata unavailable (the post may be private, rate-limited, or blocked by Instagram)",
      details: error.message
    };
  }
}
