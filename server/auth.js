import express from "express";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

export const DEFAULT_DATA_DIR = fileURLToPath(new URL("./data/", import.meta.url));
export const AUTH_COOKIE_NAME = "myweb_admin_session";
const DEFAULT_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const PASSWORD_KEY_LENGTH = 64;
const SCRYPT_PARAMETERS = Object.freeze({ N: 32768, r: 8, p: 3 });
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;
const deriveKey = promisify(scrypt);
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function validUsername(username) {
  return typeof username === "string" &&
    [...username].length >= 3 && [...username].length <= 64 &&
    /^[\p{L}\p{N}_][\p{L}\p{N}_.-]*$/u.test(username);
}

function validPassword(password) {
  return typeof password === "string" && password.length >= 12 && password.length <= 128;
}

async function passwordKey(password, salt) {
  return deriveKey(password, salt, PASSWORD_KEY_LENGTH, {
    ...SCRYPT_PARAMETERS,
    maxmem: SCRYPT_MAX_MEMORY,
  });
}

// Shared with the offline setup CLI. No password or default account is written by the server.
export async function createAdminRecord({ username, password }) {
  if (!validUsername(username)) {
    const error = new Error("用户名须为 3–64 个字母、数字、下划线、点或短横线，且不能以点或短横线开头。");
    error.code = "INVALID_CREDENTIALS";
    throw error;
  }
  if (!validPassword(password)) {
    const error = new Error("密码长度须为 12–128 个字符。");
    error.code = "INVALID_CREDENTIALS";
    throw error;
  }
  const salt = randomBytes(32);
  const hash = await passwordKey(password, salt);
  return {
    version: 1,
    username,
    password: {
      algorithm: "scrypt",
      ...SCRYPT_PARAMETERS,
      keyLength: PASSWORD_KEY_LENGTH,
      salt: salt.toString("base64url"),
      hash: hash.toString("base64url"),
    },
  };
}

function validEncodedBytes(value, length) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) return false;
  const bytes = Buffer.from(value, "base64url");
  return bytes.length === length && bytes.toString("base64url") === value;
}

async function readAdminRecord(dataDir) {
  let raw;
  try {
    raw = await fs.readFile(path.join(dataDir, "admin.json"), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw new Error("无法读取管理员配置，请检查数据目录权限。", { cause: error });
  }
  try {
    if (Buffer.byteLength(raw, "utf8") > 16 * 1024) throw new Error("Invalid record size");
    const record = JSON.parse(raw);
    const password = record?.password;
    if (record?.version !== 1 || !validUsername(record.username) ||
      password?.algorithm !== "scrypt" || password.N !== SCRYPT_PARAMETERS.N ||
      password.r !== SCRYPT_PARAMETERS.r || password.p !== SCRYPT_PARAMETERS.p ||
      password.keyLength !== PASSWORD_KEY_LENGTH ||
      !validEncodedBytes(password.salt, 32) || !validEncodedBytes(password.hash, PASSWORD_KEY_LENGTH)) {
      throw new Error("Invalid record");
    }
    return record;
  } catch {
    // A malformed file must never silently enable first-time setup or accept a weaker hash.
    throw new Error("管理员配置无效，请在服务器检查配置或使用 npm run admin:setup -- --reset 重置。");
  }
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function equalStrings(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function readSessionCookie(header) {
  if (typeof header !== "string") return null;
  let token = null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== AUTH_COOKIE_NAME) continue;
    // Duplicate cookies are ambiguous across browsers/proxies, so fail closed.
    if (token !== null) return null;
    token = part.slice(separator + 1).trim();
    if (!TOKEN_PATTERN.test(token)) return null;
  }
  return token;
}

function noStore(_req, res, next) {
  res.set("Cache-Control", "no-store");
  res.set("Pragma", "no-cache");
  if (next) next();
}

function positiveInteger(name, value) {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${name} must be a positive safe integer`);
}

/**
 * Mount middleware at /api before mounting router at /api/auth. The parent app owns
 * JSON parsing and global Origin/Fetch-Metadata checks (including login).
 * Options after sessionTtlMs are useful for deterministic, isolated tests.
 */
export async function createAuth({
  dataDir = DEFAULT_DATA_DIR,
  secureCookies = false,
  sessionTtlMs = DEFAULT_SESSION_TTL_MS,
  now = Date.now,
  maxSessions = 1000,
  loginRateLimit = 10,
  loginWindowMs = 15 * 60 * 1000,
  maxLoginSources = 10000,
  maxConcurrentLogins = 4,
} = {}) {
  for (const [name, value] of Object.entries({
    sessionTtlMs, maxSessions, loginRateLimit, loginWindowMs, maxLoginSources, maxConcurrentLogins,
  })) positiveInteger(name, value);
  if (typeof now !== "function") throw new TypeError("now must be a function");
  if (typeof secureCookies !== "boolean") throw new TypeError("secureCookies must be a boolean");

  const admin = await readAdminRecord(path.resolve(dataDir));
  // Only SHA-256 token digests are retained; raw session tokens only leave via Set-Cookie.
  const sessions = new Map();
  const loginSources = new Map();
  const requestSessionKey = Symbol("admin-session-digest");
  let concurrentLogins = 0;
  const cookieOptions = { httpOnly: true, sameSite: "lax", secure: secureCookies, path: "/api" };

  function pruneSessions(time) {
    for (const [key, session] of sessions) {
      if (session.expiresAt <= time) sessions.delete(key);
    }
  }

  function middleware(req, _res, next) {
    req.auth = null;
    req[requestSessionKey] = null;
    const time = now();
    pruneSessions(time);
    const token = readSessionCookie(req.headers.cookie);
    if (token) {
      const key = hashToken(token);
      const session = sessions.get(key);
      if (session) {
        req[requestSessionKey] = key;
        req.auth = { user: { username: session.username }, csrfToken: session.csrfToken };
      }
    }
    next();
  }

  function requireAuth(req, res, next) {
    noStore(req, res);
    if (!req.auth) return res.status(401).json({ error: "需要管理员登录。" });
    next();
  }

  function requireCsrf(req, res, next) {
    noStore(req, res);
    if (UNSAFE_METHODS.has(req.method) &&
      (!req.auth || !equalStrings(req.get("X-CSRF-Token"), req.auth.csrfToken))) {
      return res.status(403).json({ error: "CSRF 校验失败。" });
    }
    next();
  }

  function payload(auth) {
    return {
      user: auth?.user ?? null,
      csrfToken: auth?.csrfToken ?? null,
      configured: admin !== null,
    };
  }

  function consumeLoginAttempt(req, time) {
    for (const [address, entry] of loginSources) {
      if (entry.resetAt <= time) loginSources.delete(address);
    }
    // Do not use req.ip: Express may trust X-Forwarded-For in the parent application.
    const address = req.socket?.remoteAddress || "unknown";
    let entry = loginSources.get(address);
    if (!entry) {
      if (loginSources.size >= maxLoginSources) {
        let earliestReset = time + loginWindowMs;
        for (const source of loginSources.values()) earliestReset = Math.min(earliestReset, source.resetAt);
        return Math.max(1, Math.ceil((earliestReset - time) / 1000));
      }
      entry = { attempts: 0, resetAt: time + loginWindowMs };
      loginSources.set(address, entry);
    }
    if (entry.attempts >= loginRateLimit) return Math.max(1, Math.ceil((entry.resetAt - time) / 1000));
    entry.attempts += 1;
    return 0;
  }

  const router = express.Router();
  router.use(noStore);
  router.get("/session", (req, res) => res.json(payload(req.auth)));
  router.post("/login", async (req, res) => {
    const retryAfter = consumeLoginAttempt(req, now());
    if (retryAfter || concurrentLogins >= maxConcurrentLogins) {
      res.set("Retry-After", String(retryAfter || 1));
      return res.status(429).json({ error: "登录尝试过多，请稍后再试。" });
    }
    if (!admin) {
      return res.status(503).json({ error: "管理员尚未配置，请在服务器运行 npm run admin:setup。" });
    }

    concurrentLogins += 1;
    try {
      const { username, password } = req.body && typeof req.body === "object" ? req.body : {};
      const validInput = validUsername(username) && validPassword(password);
      // Invalid usernames and bounded/invalid passwords still perform one scrypt operation.
      const candidate = await passwordKey(
        typeof password === "string" && password.length <= 128 ? password : "",
        Buffer.from(admin.password.salt, "base64url"),
      );
      const passwordMatches = timingSafeEqual(candidate, Buffer.from(admin.password.hash, "base64url"));
      const usernameMatches = equalStrings(validUsername(username) ? username : "", admin.username);
      if (!validInput || !passwordMatches || !usernameMatches) {
        return res.status(401).json({ error: "用户名或密码错误。" });
      }

      const time = now();
      pruneSessions(time);
      // A successful login rotates this browser's session; failed logins do not revoke it.
      sessions.delete(req[requestSessionKey]);
      while (sessions.size >= maxSessions) sessions.delete(sessions.keys().next().value);
      const token = randomBytes(32).toString("base64url");
      const csrfToken = randomBytes(32).toString("base64url");
      const key = hashToken(token);
      sessions.set(key, { username: admin.username, csrfToken, expiresAt: time + sessionTtlMs });
      req[requestSessionKey] = key;
      req.auth = { user: { username: admin.username }, csrfToken };
      res.cookie(AUTH_COOKIE_NAME, token, { ...cookieOptions, maxAge: sessionTtlMs });
      return res.json(payload(req.auth));
    } catch {
      return res.status(503).json({ error: "登录服务暂不可用，请稍后重试。" });
    } finally {
      concurrentLogins -= 1;
    }
  });
  router.post("/logout", requireAuth, requireCsrf, (req, res) => {
    sessions.delete(req[requestSessionKey]);
    req[requestSessionKey] = null;
    req.auth = null;
    res.clearCookie(AUTH_COOKIE_NAME, cookieOptions);
    res.status(204).end();
  });

  return { router, middleware, requireAuth, requireCsrf };
}
