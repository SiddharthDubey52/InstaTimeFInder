import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { processInstagramUrl } from "./services/instagramMetadata.js";
import { processYouTubeUrl } from "./services/youtubeMetadata.js";
import { toCsv, toExcel } from "./services/export.js";
import { authStatus, issueSession, requireAuth, COOKIE_NAME } from "./middleware/auth.js";

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const reports = [];
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || true,
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH || !process.env.JWT_SECRET) {
  throw new Error("ADMIN_USERNAME, ADMIN_PASSWORD_HASH, and JWT_SECRET must be configured");
}

app.get("/api/auth/status", authStatus);
app.post("/api/auth/login", loginLimiter, async (req, res) => {
  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const validUsername = username === ADMIN_USERNAME;
  const validPassword = password ? await bcrypt.compare(password, ADMIN_PASSWORD_HASH) : false;
  if (!validUsername || !validPassword) return res.status(401).json({ error: "Invalid username or password" });
  issueSession(res, username);
  res.json({ authenticated: true, username });
});
app.post("/api/auth/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  res.json({ authenticated: false });
});

app.use("/api", (req, res, next) => {
  if (req.path.startsWith("/auth/") || req.path === "/health") return next();
  return requireAuth(req, res, next);
});

function extractUrls(buffer) {
  const source = buffer.toString("utf8");
  const rows = parse(source, {
    columns: false,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true
  });
  if (!rows.length) throw new Error("CSV contains no records");

  const urlPattern = /https?:\/\/(?:www\.)?(?:instagram\.com|youtube\.com|youtu\.be)\//i;
  const firstRowHasUrl = rows[0].some((value) => urlPattern.test(String(value)));
  if (firstRowHasUrl) {
    return rows
      .map((row) => row.find((value) => urlPattern.test(String(value))) || row[0])
      .map((value) => String(value || "").trim())
      .filter(Boolean);
  }

  const records = parse(source, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true
  });
  const keys = Object.keys(records[0] || {});
  const urlKey = keys.find((key) => /url|link/i.test(key)) || keys[0];
  return records.map((row) => String(row[urlKey] || "").trim()).filter(Boolean);
}

app.post("/api/upload-csv", upload.single("file"), (req, res) => {
  try {
    if (!req.file || (!req.file.originalname.toLowerCase().endsWith(".csv") && req.file.mimetype !== "text/csv")) {
      return res.status(400).json({ error: "Please upload a CSV file." });
    }
    const urls = extractUrls(req.file.buffer);
    const uniqueUrls = new Set(urls.map((url) => url.toLowerCase()));
    return res.json({
      filename: req.file.originalname,
      urls,
      totalUrls: urls.length,
      duplicateUrls: urls.length - uniqueUrls.size
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Unable to parse CSV" });
  }
});

app.post("/api/process-posts", async (req, res) => {
  const platform = req.body?.platform === "youtube" ? "youtube" : "instagram";
  const urls = Array.isArray(req.body?.urls) ? req.body.urls.slice(0, 1000) : [];
  if (!urls.length) return res.status(400).json({ error: "At least one URL is required." });
  const results = [];
  for (let index = 0; index < urls.length; index += 5) {
    const batch = urls.slice(index, index + 5);
    const processor = platform === "youtube" ? processYouTubeUrl : processInstagramUrl;
    results.push(...await Promise.all(batch.map((url) => processor(url))));
  }
  const report = { id: randomUUID(), createdAt: new Date().toISOString(), totalUrls: urls.length, results };
  reports.unshift(report);
  res.json({ results, reportId: report.id });
});


app.get("/api/reports", (_req, res) => res.json(reports.map(({ id, createdAt, totalUrls, results }) => ({
  id, createdAt, totalUrls, successful: results.filter((item) => item.status === "success").length,
  failed: results.filter((item) => item.status === "failed").length
}))));
app.get("/api/reports/:id", (req, res) => {
  const report = reports.find((item) => item.id === req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found" });
  res.json(report);
});

app.post("/api/export/csv", (req, res) => {
  const platform = req.body?.platform === "youtube" ? "youtube" : "instagram";
  res.type("text/csv").attachment(`${platform}-report.csv`).send(toCsv(req.body.results || [], platform));
});
app.post("/api/export/excel", (req, res) => {
  const platform = req.body?.platform === "youtube" ? "youtube" : "instagram";
  toExcel(req.body.results || [], req.body.stats || {}, platform).then((buffer) => {
    res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").attachment(`${platform}-date-wise-report.xlsx`).send(buffer);
  }).catch((error) => {
    res.status(500).json({ error: `Excel export failed: ${error.message}` });
  });
});
app.get("/api/health", (_req, res) => res.json({ ok: true }));

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
