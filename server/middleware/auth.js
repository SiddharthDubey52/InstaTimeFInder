import jwt from "jsonwebtoken";

export const COOKIE_NAME = "timefinder_session";
export const SESSION_MAX_AGE = 8 * 60 * 60 * 1000;

function jwtSecret() {
  return process.env.JWT_SECRET;
}

export function issueSession(res, username) {
  const token = jwt.sign({ sub: username }, jwtSecret(), { expiresIn: "8h" });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
    path: "/"
  });
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Authentication required" });
  try {
    req.auth = jwt.verify(token, jwtSecret());
    next();
  } catch {
    res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax", secure: process.env.NODE_ENV === "production", path: "/" });
    return res.status(401).json({ error: "Session is invalid or expired" });
  }
}

export function authStatus(req, res) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.json({ authenticated: false });
  try {
    const payload = jwt.verify(token, jwtSecret());
    return res.json({ authenticated: true, username: payload.sub });
  } catch {
    return res.json({ authenticated: false });
  }
}
