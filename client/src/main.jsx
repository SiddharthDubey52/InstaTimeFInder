import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import { BarChart3, CheckCircle2, ChevronDown, ChevronUp, Clock3, Download, Eye, EyeOff, FileSpreadsheet, FileUp, Film, Instagram, LogOut, Search, XCircle } from "lucide-react";
import "./styles.css";

axios.defaults.withCredentials = true;

const initial = { totalUrls: 0, successful: 0, failed: 0, posts: 0, reels: 0, datesFound: 0 };
const fmtDate = (item) => item.publishedAtIst?.slice(0, 10) || null;
const fmtTime = (item) => item.publishedAtIst?.slice(11) || "Unavailable";

function App() {
  const [authState, setAuthState] = useState("checking");
  const [authError, setAuthError] = useState("");
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [urls, setUrls] = useState([]);
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState(initial);
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All");
  const [status, setStatus] = useState("All");
  const [sort, setSort] = useState("newest");
  const [open, setOpen] = useState({});
  const [platform, setPlatform] = useState("instagram");

  useEffect(() => {
    axios.get("/api/auth/status").then(({ data }) => setAuthState(data.authenticated ? "authenticated" : "unauthenticated"))
      .catch(() => setAuthState("unauthenticated"));
  }, []);

  const login = async (event) => {
    event.preventDefault();
    setAuthError("");
    try {
      const { data } = await axios.post("/api/auth/login", loginForm);
      if (!data.authenticated) throw new Error("Authentication was not completed");
      setAuthState("authenticated");
    } catch (error) {
      setAuthError(error.response?.data?.error || "Unable to sign in");
    }
  };

  const logout = async () => {
    await axios.post("/api/auth/logout").catch(() => {});
    setAuthState("unauthenticated");
    setResults([]);
    setUrls([]);
  };

  const chooseFile = async (file) => {
    if (!file) return;
    const form = new FormData(); form.append("file", file);
    try {
      const response = await axios.post("/api/upload-csv", form);
      setUrls(response.data.urls); setFileName(`${response.data.filename}${response.data.duplicateUrls ? ` · ${response.data.duplicateUrls} duplicates` : ""}`); setResults([]); setProgress(0);
      setStats({ ...initial, totalUrls: response.data.totalUrls });
    } catch (error) { window.alert(error.response?.data?.error || "Could not read the CSV."); }
  };
  const process = async () => {
    if (!urls.length) return;
    setBusy(true); setProgress(15);
    const progressTimer = setInterval(() => setProgress((value) => Math.min(value + 5, 90)), 1000);
    try {
      const response = await axios.post("/api/process-posts", { urls, platform });
      setResults(response.data.results);
      const next = response.data.results.reduce((acc, item) => {
        acc[item.status === "failed" ? "failed" : "successful"]++;
        if (item.postType === "Post" || item.videoType === "Video") acc.posts++; if (item.postType === "Reel" || item.videoType === "Short") acc.reels++;
        if (fmtDate(item)) acc._dates.add(fmtDate(item)); return acc;
      }, { ...initial, totalUrls: urls.length, _dates: new Set() });
      setStats({ ...next, datesFound: next._dates.size }); setProgress(100);
    } catch (error) { window.alert(error.response?.data?.error || "Processing failed."); }
    finally { clearInterval(progressTimer); setBusy(false); }
  };
  const filtered = useMemo(() => results.filter((item) => {
    const text = `${item.username || ""} ${item.pageName || ""} ${item.normalizedUrl}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (type === "All" || item.postType === type) && (status === "All" || item.status === status.toLowerCase());
  }).sort((a, b) => {
    const date = (a.publishedAtIst || "").localeCompare(b.publishedAtIst || "");
    return sort === "newest" ? -date : date;
  }), [results, query, type, status, sort]);
  const groups = useMemo(() => filtered.reduce((acc, item) => { const key = fmtDate(item) || "Date Unavailable"; (acc[key] ||= []).push(item); return acc; }, {}), [filtered]);
  const download = async (format) => {
    const response = await axios.post(`/api/export/${format}`, { results, stats, platform }, { responseType: "blob" });
    const url = URL.createObjectURL(response.data); const link = document.createElement("a"); link.href = url; link.download = platform === "youtube" ? `youtube-${format === "csv" ? "report.csv" : "date-wise-report.xlsx"}` : `instagram-${format === "csv" ? "report.csv" : "date-wise-report.xlsx"}`; link.click(); URL.revokeObjectURL(url);
  };
  const cards = [["Total URLs", stats.totalUrls, FileUp], ["Successful", stats.successful, CheckCircle2], ["Failed", stats.failed, XCircle], [platform === "youtube" ? "Videos" : "Posts", stats.posts, Instagram], [platform === "youtube" ? "Shorts" : "Reels", stats.reels, Film], ["Dates Found", stats.datesFound, Clock3]];

  if (authState === "checking") return <div className="auth-loading">Checking secure session...</div>;
  if (authState === "unauthenticated") return <div className="login-page"><form className="login-card" onSubmit={login}><div className="login-brand"><span className="logo"><Instagram size={22} /></span><span>Time<span className="gradient">Finder</span></span></div><p className="eyebrow">ADMIN ACCESS</p><h1>Welcome Back</h1><p className="login-subtitle">Sign in to access your admin dashboard.</p><label>Username<input autoComplete="username" value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} required /></label><label>Password<div className="password-field"><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>{authError && <p className="login-error">{authError}</p>}<button className="login-button" type="submit">Sign in</button></form></div>;
  return <div className="app">
    <header><div className="brand"><span className="logo"><Instagram size={22} /></span><span>Time<span className="gradient">Finder</span></span></div><nav><a className="active">Dashboard</a><a>How it works</a><a>Privacy</a></nav><div className="header-actions"><span className="status-dot">Secure session</span><button className="logout-button" onClick={logout}><LogOut size={14} /> Logout</button></div></header>
    <main>
      <section className="hero"><div><p className="eyebrow">{platform === "youtube" ? "YOUTUBE ANALYTICS" : "INSTAGRAM ANALYTICS"}</p><h1>Find the exact time<br /><span className="gradient">your content went live.</span></h1><p className="subtitle">Upload a CSV of {platform === "youtube" ? "YouTube videos and Shorts" : "Instagram posts and reels"}. We organize every result by publishing date.</p></div><div className="hero-mark"><BarChart3 size={108} strokeWidth={1} /></div></section>
      <div className="platform-switch" role="group" aria-label="Platform"><button className={platform === "instagram" ? "selected" : ""} onClick={() => { setPlatform("instagram"); setResults([]); setUrls([]); }}>Instagram</button><button className={platform === "youtube" ? "selected" : ""} onClick={() => { setPlatform("youtube"); setResults([]); setUrls([]); }}>YouTube</button></div>
      <section className="upload-card"><div className="section-title"><div><h2>Upload your links</h2><p>CSV files only · Up to 1,000 {platform === "youtube" ? "videos" : "URLs"} · Authenticated session required</p></div>{fileName && <span className="file-pill">{fileName} · {urls.length} URLs</span>}</div>
        <div className={`drop-zone ${dragging ? "dragging" : ""}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); chooseFile(e.dataTransfer.files[0]); }}>
          <input id="file" type="file" accept=".csv,text/csv" onChange={(e) => chooseFile(e.target.files[0])} /><label htmlFor="file"><span className="upload-icon"><FileUp /></span><strong>Drop your CSV here, or <u>browse files</u></strong><small>Supported columns: URL, Link, {platform === "youtube" ? "YouTube URL" : "Instagram URL"}, Post Link</small></label>
        </div>
        <div className="process-row"><div className="progress-wrap"><div className="progress-label"><span>{busy ? "Processing posts..." : progress === 100 ? "Processing complete" : "Ready to process"}</span><b>{progress}%</b></div><div className="progress"><i style={{ width: `${progress}%` }} /></div></div><button className="primary" disabled={!urls.length || busy} onClick={process}>{busy ? "Working..." : "Process URLs"} <span>→</span></button></div>
      </section>
      <section className="stats">{cards.map(([label, value, Icon]) => <div className="stat" key={label}><div className="stat-icon"><Icon size={18} /></div><div><small>{label}</small><strong>{value}</strong></div></div>)}</section>
      <section className="results"><div className="results-header"><div><p className="eyebrow">YOUR REPORT</p><h2>Date-wise results <span>{filtered.length} records</span></h2></div><div className="actions"><button onClick={() => download("csv")} disabled={!results.length}><Download size={15} /> Export CSV</button><button onClick={() => download("excel")} disabled={!results.length}><FileSpreadsheet size={15} /> Export Excel</button></div></div>
        <div className="filters"><div className="search"><Search size={16} /><input placeholder="Search username, page, or URL..." value={query} onChange={(e) => setQuery(e.target.value)} /></div><select value={type} onChange={(e) => setType(e.target.value)}><option>All types</option>{platform === "youtube" ? <><option>Video</option><option>Short</option></> : <><option>Post</option><option>Reel</option></>}</select><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="All">All status</option><option value="Success">Successful</option><option value="Partial">Partial metadata</option><option value="Failed">Failed</option></select><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></div>
        {!results.length ? <div className="empty"><Clock3 size={30} /><h3>Your report will appear here</h3><p>Upload a CSV above to begin organizing your content.</p></div> : <div className="groups">{Object.entries(groups).sort(([a], [b]) => b.localeCompare(a)).map(([date, items]) => <div className="date-group" key={date}><button className="date-heading" onClick={() => setOpen((state) => ({ ...state, [date]: !state[date] }))}><span><b>{date === "Date Unavailable" ? date : new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</b><small>{items.length} {items.length === 1 ? "record" : "records"} · IST</small></span>{open[date] === false ? <ChevronDown /> : <ChevronUp />}</button>{open[date] !== false && <div className="table"><div className="table-head"><span>{platform === "youtube" ? "Channel" : "Page"}</span><span>{platform === "youtube" ? "YouTube link" : "Instagram link"}</span><span>Publishing time</span><span>Status</span></div>{items.map((item, index) => <div className="row" key={`${item.originalUrl}-${index}`}><div><b>{platform === "youtube" ? item.channelName : item.pageName || "Not Available"}</b><small>{platform === "youtube" ? item.channelHandle : item.username || "Username unavailable"}</small></div><div><a href={item.originalUrl || item.normalizedUrl} target="_blank" rel="noreferrer">{item.videoType || item.postType || platform} <span>↗</span></a><small>{item.videoId || item.shortcode || item.originalUrl}</small></div><div><b>{fmtTime(item)}</b><small>{item.timestampSource}</small></div><div><span className={`badge ${item.status}`}>{item.status}</span>{item.error && <small className="error">{item.error}</small>}</div></div>)}</div>}</div>)}</div>}
      </section>
    </main><footer><span>TimeFinder</span><span>Metadata access depends on Instagram availability. We never request credentials.</span><span>Built for transparent analysis · 2026</span></footer>
  </div>;
}
createRoot(document.getElementById("root")).render(<App />);
