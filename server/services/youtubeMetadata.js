const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);
const requestHeaders = { "User-Agent": "Mozilla/5.0 (compatible; TimeFinder/1.0)" };

export function parseYouTubeUrl(value) {
  try {
    const url = new URL(String(value).trim());
    const host = url.hostname.toLowerCase();
    if (!YOUTUBE_HOSTS.has(host)) throw new Error("Not a YouTube URL");

    let videoId = null;
    let type = "Video";
    if (host === "youtu.be") videoId = url.pathname.split("/").filter(Boolean)[0];
    else if (url.pathname === "/watch") videoId = url.searchParams.get("v");
    else if (/^\/(shorts|embed)\//.test(url.pathname)) {
      const [, segment, id] = url.pathname.split("/");
      videoId = id;
      type = segment === "shorts" ? "Short" : "Video";
    }
    if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new Error("Invalid YouTube video ID");
    return {
      videoId,
      videoType: type,
      normalizedUrl: `https://www.youtube.com/watch?v=${videoId}`
    };
  } catch (error) {
    return { valid: false, error: error.message || "Invalid YouTube URL" };
  }
}

function istFields(date) {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).format(date).replace(",", "");
  return {
    publishedAtUtc: date.toISOString(),
    publishedAtIst: formatted,
    publishingDate: formatted.slice(0, 10),
    publishingTimeIst: formatted.slice(11)
  };
}

function baseResult(rawUrl) {
  const originalUrl = String(rawUrl ?? "").trim();
  const parsed = parseYouTubeUrl(originalUrl);
  if (parsed.valid === false) return { originalUrl, status: "failed", error: parsed.error };
  return {
    originalUrl, normalizedUrl: parsed.normalizedUrl, videoId: parsed.videoId,
    videoType: parsed.videoType, postType: parsed.videoType,
    channelName: "Not Available", channelHandle: "Not Available",
    pageName: "Not Available", username: null, status: "pending",
    timestampSource: "Unavailable", error: null
  };
}

export async function processYouTubeUrl(rawUrl) {
  const result = baseResult(rawUrl);
  if (result.status === "failed") return result;
  const apiKey = process.env.YOUTUBE_API_KEY;

  try {
    if (apiKey) {
      const videoResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${result.videoId}&key=${encodeURIComponent(apiKey)}`);
      if (!videoResponse.ok) throw new Error(`YouTube API returned HTTP ${videoResponse.status}`);
      const videoData = await videoResponse.json();
      const item = videoData.items?.[0];
      if (!item) return { ...result, status: "failed", error: "Video unavailable, private, or deleted" };
      const snippet = item.snippet;
      result.channelName = snippet.channelTitle || "Not Available";
      result.pageName = result.channelName;
      result.channelHandle = snippet.customUrl
        ? (snippet.customUrl.startsWith("@") ? snippet.customUrl : `@${snippet.customUrl.replace(/^\/@/, "")}`)
        : "Not Available";
      if (snippet.channelId) {
        const channelResponse = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${encodeURIComponent(snippet.channelId)}&key=${encodeURIComponent(apiKey)}`);
        if (channelResponse.ok) {
          const channel = (await channelResponse.json()).items?.[0]?.snippet;
          const customUrl = channel?.customUrl;
          if (customUrl) result.channelHandle = customUrl.startsWith("@") ? customUrl : `@${customUrl.replace(/^\/@/, "")}`;
        }
      }
      if (snippet.publishedAt) Object.assign(result, istFields(new Date(snippet.publishedAt)), { timestampSource: "YouTube Data API" });
      result.status = "success";
      return result;
    }

    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(result.originalUrl)}&format=json`, { headers: requestHeaders });
    if (!response.ok) throw new Error(`YouTube oEmbed returned HTTP ${response.status}`);
    const metadata = await response.json();
    result.channelName = metadata.author_name || "Not Available";
    result.pageName = result.channelName;
    result.channelHandle = "Not Available";
    result.status = "partial";
    result.error = "Set YOUTUBE_API_KEY to retrieve the verified publishing date and channel handle";
    return result;
  } catch (error) {
    return { ...result, status: "failed", error: error.message };
  }
}
