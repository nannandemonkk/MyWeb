import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { createAuth } from "./auth.js";
import { createPostStore } from "./posts.js";
import { HttpError } from "./errors.js";

function validateOrigins(origins) {
  return origins.map((origin) => {
    const parsed = new URL(origin);
    if (!["https:", "http:"].includes(parsed.protocol) || parsed.origin !== origin || parsed.username || parsed.password) {
      throw new Error("APP_ORIGIN 必须是完整的 http(s) 来源（不包含路径或末尾斜杠）");
    }
    return parsed.origin;
  });
}

function sameOriginOnly(allowedOrigins) {
  return (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    if (req.get("Sec-Fetch-Site") === "cross-site") return res.status(403).json({ error: "不允许跨站操作。" });
    const origin = req.get("Origin");
    if (origin) {
      const expected = allowedOrigins.length ? allowedOrigins : [`${req.protocol}://${req.get("host")}`];
      if (!expected.includes(origin)) return res.status(403).json({ error: "请求来源不受信任，请从本站页面操作。" });
    }
    // Non-browser clients may omit Origin, but mutations still require a session and CSRF token.
    return next();
  };
}

function requireJson(req, res, next) {
  if (!req.is("application/json")) return res.status(415).json({ error: "请使用 application/json 提交数据。" });
  next();
}

/** No listener on import: tests use an isolated app/store and never touch real articles. */
export async function createApp({
  dataDir = process.env.DATA_DIR || path.join(import.meta.dirname, "data"),
  docsDir = process.env.DOCS_DIR || path.join(import.meta.dirname, "document"),
  draftsDir,
  allowedOrigins = [],
  secureCookies = process.env.NODE_ENV === "production",
  serveFrontend = false,
  distDir = path.resolve(import.meta.dirname, "../dist"),
  trustProxy = false,
  authOptions = {},
  logger = console,
} = {}) {
  dataDir = path.resolve(dataDir);
  draftsDir ||= path.join(dataDir, "drafts");
  const origins = validateOrigins(allowedOrigins);
  const auth = await createAuth({ ...authOptions, dataDir, secureCookies });
  const posts = await createPostStore({ docsDir, draftsDir, logger });
  const app = express();
  app.disable("x-powered-by");
  app.disable("etag");
  app.set("trust proxy", trustProxy);
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "same-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
    next();
  });
  app.use("/api", (req, res, next) => {
    // Public content can be withdrawn; private responses must never enter shared/browser caches.
    res.set("Cache-Control", "no-store");
    res.vary("Cookie");
    next();
  }, sameOriginOnly(origins), express.json({ limit: "1mb", strict: true }), auth.middleware);

  app.get("/api/health", (req, res) => res.json({ ok: true }));
  app.post("/api/auth/login", requireJson);
  app.use("/api/auth", auth.router);

  app.get("/api/posts", async (req, res) => res.json(await posts.listPublic()));
  app.get("/api/posts/:slug", async (req, res) => res.json(await posts.getPublic(req.params.slug)));

  const admin = express.Router();
  admin.use(auth.requireAuth);
  admin.use((req, res, next) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return auth.requireCsrf(req, res, next);
    next();
  });
  admin.get("/posts", async (req, res) => res.json(await posts.listAdmin(req.query.status ?? "all")));
  admin.get("/posts/:slug", async (req, res) => res.json(await posts.getAdmin(req.params.slug)));
  admin.post("/posts", requireJson, async (req, res) => {
    const post = await posts.create(req.body);
    res.status(201).location(`/api/admin/posts/${encodeURIComponent(post.slug)}`).json(post);
  });
  admin.put("/posts/:slug", requireJson, async (req, res) => res.json(await posts.update(req.params.slug, req.body)));
  admin.delete("/posts/:slug", requireJson, async (req, res) => {
    await posts.delete(req.params.slug, req.body?.version);
    res.sendStatus(204);
  });
  app.use("/api/admin", admin);
  app.use("/api", (req, res) => res.status(404).json({ error: "接口不存在。" }));

  if (serveFrontend) {
    distDir = path.resolve(distDir);
    distDir = await fs.realpath(distDir);
    const sensitiveDirectories = await Promise.all([dataDir, docsDir, draftsDir, import.meta.dirname].map((directory) => fs.realpath(directory)));
    const contains = (parent, child) => {
      const relative = path.relative(parent, child);
      return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
    };
    if (sensitiveDirectories.some((directory) => contains(distDir, directory) || contains(directory, distDir))) {
      throw new Error("静态目录不能与后端代码、文章或私有数据目录重叠，请只托管前端构建产物。");
    }
    const indexFile = path.join(distDir, "index.html");
    await fs.access(indexFile); // Fail early if npm run build has not been run.
    app.use((req, res, next) => {
      res.set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
      next();
    });
    app.use(express.static(distDir, { index: false, dotfiles: "deny" }));
    app.get(/.*/, (req, res, next) => {
      if (path.extname(req.path) || !req.accepts("html")) return next();
      res.set("Cache-Control", "no-cache").sendFile(indexFile);
    });
  }
  app.use((req, res) => res.status(404).type("text").send("Not found"));
  // Express error middleware deliberately has four parameters.
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === "entity.too.large") return res.status(413).json({ error: "请求体过大，最多 1 MiB。" });
    if (error.type === "entity.parse.failed" || error instanceof URIError) return res.status(400).json({ error: "请求格式有误。" });
    if (["charset.unsupported", "encoding.unsupported"].includes(error.type)) return res.status(415).json({ error: "不支持此请求字符集或编码。" });
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    logger.error?.("服务器请求失败:", error);
    return res.status(500).json({ error: "服务器内部错误，请稍后重试。" });
  });
  return app;
}
