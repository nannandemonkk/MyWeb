import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createApp } from "./app.js";
import { setupAdmin } from "./setup-admin.js";

async function fixture(t, { configured = true, ...options } = {}) {
  const parent = path.resolve(import.meta.dirname, "../artifacts/test-runs");
  await fs.mkdir(parent, { recursive: true });
  const root = await fs.mkdtemp(path.join(parent, "api-"));
  t.after(async () => {
    assert.equal(path.dirname(root), parent);
    assert.ok(path.basename(root).startsWith("api-"));
    await fs.rm(root, { recursive: true, force: true });
  });
  const dataDir = path.join(root, "data");
  const docsDir = path.join(root, "document");
  const distDir = path.join(root, "dist");
  await fs.mkdir(docsDir, { recursive: true });
  await fs.mkdir(distDir, { recursive: true });
  await fs.writeFile(path.join(distDir, "index.html"), "<!doctype html><title>fixture app</title><div id='root'></div>");
  await fs.writeFile(path.join(distDir, "bundle.js"), "console.log('fixture asset');");
  await fs.writeFile(path.join(docsDir, "旧笔记.md"), "# 旧笔记\n\n真实公开记录。\n");
  const account = { username: "test-owner", password: randomBytes(24).toString("base64url") };
  if (configured) await setupAdmin({ dataDir, ...account });
  const errors = [];
  const app = await createApp({ dataDir, docsDir, distDir, logger: { error: (...args) => errors.push(args), warn: () => {} }, ...options });
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    listener.once("error", reject);
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  async function request(route, { method = "GET", body, raw, cookie, csrf, headers = {} } = {}) {
    const response = await fetch(`${origin}${route}`, {
      method,
      headers: {
        ...(body !== undefined || raw !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : raw !== undefined ? { body: raw } : {}),
    });
    const text = await response.text();
    const result = text && response.headers.get("content-type")?.includes("application/json") ? JSON.parse(text) : text;
    return { status: response.status, body: result, headers: response.headers };
  }
  async function login() {
    const response = await request("/api/auth/login", { method: "POST", body: account, headers: { Origin: options.allowedOrigins?.[0] || origin } });
    assert.equal(response.status, 200);
    return { cookie: response.headers.get("set-cookie").split(";")[0], csrf: response.body.csrfToken };
  }
  return { root, dataDir, docsDir, origin, request, login, account, errors };
}

const draft = (extra = {}) => ({
  slug: "我的草稿", title: "我的第一篇", content: "私密草稿正文\n", date: "2026-10-28", type: "note",
  tags: ["日常"], excerpt: "", pinned: false, status: "draft", ...extra,
});

test("public legacy reads work while every management operation requires authentication", async (t) => {
  const { request } = await fixture(t);
  const publicList = await request("/api/posts");
  assert.equal(publicList.status, 200);
  assert.equal(publicList.body.length, 1);
  assert.equal(publicList.body[0].slug, "旧笔记");
  assert.equal("content" in publicList.body[0], false);
  assert.equal(publicList.headers.get("cache-control"), "no-store");
  assert.equal(publicList.headers.get("x-powered-by"), null);
  assert.equal((await request(`/api/posts/${encodeURIComponent("旧笔记")}`)).body.title, "旧笔记");
  for (const [route, method, body] of [
    ["/api/admin/posts", "GET"], ["/api/admin/posts", "POST", draft()],
    ["/api/admin/posts/旧笔记", "GET"], ["/api/admin/posts/旧笔记", "PUT", draft()],
    ["/api/admin/posts/旧笔记", "DELETE", { version: "forged" }],
  ]) {
    const response = await request(route, { method, body });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  assert.equal((await request("/api/posts")).body.length, 1);
});

test("real login + CSRF protect the complete draft/publish/edit/withdraw/delete lifecycle", async (t) => {
  const { request, login, docsDir, dataDir } = await fixture(t);
  const session = await login();
  assert.equal((await request("/api/auth/session", session)).body.user.username, "test-owner");
  assert.equal((await request("/api/admin/posts", { method: "POST", cookie: session.cookie, body: draft() })).status, 403);
  const created = await request("/api/admin/posts", { ...session, method: "POST", body: draft() });
  assert.equal(created.status, 201);
  assert.equal(created.body.status, "draft");
  assert.match(created.headers.get("location"), /^\/api\/admin\/posts\//);
  assert.ok((await fs.readdir(path.join(dataDir, "drafts"))).includes("我的草稿.md"));
  assert.equal((await request("/api/posts")).body.some((p) => p.slug === "我的草稿"), false);
  assert.equal((await request("/api/posts/我的草稿", session)).status, 404);
  const listed = await request("/api/admin/posts?status=draft", session);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.length, 1);
  assert.equal("content" in listed.body[0], false);
  assert.equal((await request("/api/admin/posts/我的草稿", session)).body.content, "私密草稿正文\n");
  assert.equal((await request("/api/admin/posts", { ...session, method: "POST", body: draft() })).status, 409);
  assert.equal((await request("/api/admin/posts/我的草稿", { ...session, method: "PUT", body: draft() })).status, 428);
  const published = await request("/api/admin/posts/我的草稿", { ...session, method: "PUT", body: draft({ status: "published", version: created.body.version }) });
  assert.equal(published.status, 200);
  assert.equal((await request("/api/posts/我的草稿")).body.content, "私密草稿正文\n");
  assert.ok((await fs.readdir(docsDir)).includes("我的草稿.md"));
  const changed = await request("/api/admin/posts/我的草稿", { ...session, method: "PUT", body: draft({ status: "published", content: "更新后的公开正文\n", version: published.body.version }) });
  assert.equal(changed.status, 200);
  assert.equal((await request("/api/posts/我的草稿")).body.content, "更新后的公开正文\n");
  const conflict = await request("/api/admin/posts/我的草稿", { ...session, method: "PUT", body: draft({ status: "published", version: published.body.version }) });
  assert.equal(conflict.status, 409);
  assert.equal((await request("/api/posts/我的草稿")).body.content, "更新后的公开正文\n");
  const withdrawn = await request("/api/admin/posts/我的草稿", { ...session, method: "PUT", body: draft({ version: changed.body.version }) });
  assert.equal(withdrawn.status, 200);
  assert.equal((await request("/api/posts/我的草稿")).status, 404);
  assert.equal((await request("/api/admin/posts?status=unknown", session)).status, 400);
  assert.equal((await request("/api/admin/posts/我的草稿", { ...session, method: "DELETE", body: { version: changed.body.version } })).status, 409);
  assert.equal((await request("/api/admin/posts/我的草稿", { ...session, method: "DELETE", body: { version: withdrawn.body.version } })).status, 204);
  assert.equal((await request("/api/admin/posts/我的草稿", session)).status, 404);
  assert.equal((await request("/api/auth/logout", { ...session, method: "POST" })).status, 204);
  assert.equal((await request("/api/admin/posts", session)).status, 401);
});

test("Origin/Fetch-Metadata validation blocks cross-site login and writes, including logout", async (t) => {
  const { request, login, account, origin } = await fixture(t);
  for (const headers of [{ Origin: "https://evil.example" }, { Origin: "null" }, { "Sec-Fetch-Site": "cross-site" }]) {
    assert.equal((await request("/api/auth/login", { method: "POST", body: account, headers })).status, 403);
  }
  const session = await login();
  for (const [route, method, body] of [["/api/admin/posts", "POST", draft()], ["/api/auth/logout", "POST"]]) {
    assert.equal((await request(route, { ...session, method, body, headers: { Origin: "https://evil.example" } })).status, 403);
  }
  const legitimate = await request("/api/admin/posts", { ...session, method: "POST", body: draft(), headers: { Origin: origin, "Sec-Fetch-Site": "same-origin" } });
  assert.equal(legitimate.status, 201);
  assert.equal((await request("/api/admin/posts", session)).status, 200);
});

test("configured HTTPS origin is authoritative and production sessions use Secure cookies", async (t) => {
  const { request, account, origin } = await fixture(t, { allowedOrigins: ["https://blog.example.com"], secureCookies: true });
  const denied = await request("/api/auth/login", { method: "POST", body: account, headers: { Origin: origin } });
  assert.equal(denied.status, 403);
  const accepted = await request("/api/auth/login", { method: "POST", body: account, headers: { Origin: "https://blog.example.com" } });
  assert.equal(accepted.status, 200);
  assert.match(accepted.headers.get("set-cookie"), /; Secure(?:;|$)/);
});

test("JSON limits, portable slug checks, validation, and API errors have safe status codes", async (t) => {
  const { request, login, errors } = await fixture(t);
  assert.equal((await request("/api/auth/login", { method: "POST", raw: "username=admin", headers: { "Content-Type": "application/x-www-form-urlencoded" } })).status, 415);
  assert.equal((await request("/api/auth/login", { method: "POST", raw: "{" })).status, 400);
  assert.equal((await request("/api/auth/login", { method: "POST", raw: "x".repeat(1024 * 1024 + 1) })).status, 413);
  const session = await login();
  for (const input of [draft({ date: "2026-02-29" }), draft({ type: "owner" }), draft({ title: " " }), draft({ tags: [42] }), draft({ pinned: "true" }), draft({ status: "private" })]) {
    assert.equal((await request("/api/admin/posts", { ...session, method: "POST", body: input })).status, 400);
  }
  for (const slug of ["..%2Fapp", "a%5Cb", "a%00b", "CON", "..", "C%3Asecret"]) {
    // Encoded slashes/backslashes/ADS cannot escape either configured article directory.
    const response = await request(`/api/posts/${slug}`);
    assert.ok([400, 404].includes(response.status));
  }
  const unknown = await request("/api/no-such-route");
  assert.equal(unknown.status, 404);
  assert.deepEqual(unknown.body, { error: "接口不存在。" });
  assert.equal((await request("/api/posts/no-such-article")).status, 404);
  assert.equal(errors.length, 0);
});

test("a fresh server never exposes a web account-creation endpoint or default credentials", async (t) => {
  const { request, account, dataDir } = await fixture(t, { configured: false });
  assert.deepEqual((await request("/api/auth/session")).body, { user: null, csrfToken: null, configured: false });
  const login = await request("/api/auth/login", { method: "POST", body: account });
  assert.equal(login.status, 503);
  assert.match(login.body.error, /admin:setup/);
  assert.equal((await request("/api/auth/setup", { method: "POST", body: account })).status, 404);
  assert.equal((await request("/api/auth/register", { method: "POST", body: account })).status, 404);
  await assert.rejects(fs.access(path.join(dataDir, "admin.json")), { code: "ENOENT" });
});

test("static hosting rejects a directory that encloses backend data or documents", async (t) => {
  const { root, dataDir, docsDir } = await fixture(t);
  await fs.writeFile(path.join(root, "index.html"), "must not expose the entire project");
  await assert.rejects(createApp({ dataDir, docsDir, serveFrontend: true, distDir: root }), /静态目录不能/);
});

test("production static hosting supports SPA routes but never serves credentials, drafts or API fallbacks", async (t) => {
  const { request, dataDir } = await fixture(t, { serveFrontend: true });
  await fs.writeFile(path.join(dataDir, "drafts", "not-public.md"), "private draft fixture");
  for (const route of ["/", "/login", "/manage", "/manage/posts/微机原理/edit"]) {
    const response = await request(route, { headers: { Accept: "text/html" } });
    assert.equal(response.status, 200);
    assert.match(response.body, /fixture app/);
    assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  }
  assert.equal((await request("/bundle.js")).status, 200);
  for (const route of ["/server/data/admin.json", "/data/admin.json", "/data/drafts/not-public.md", "/document/旧笔记.md", "/missing.js"]) {
    assert.equal((await request(route)).status, 404);
  }
  const api404 = await request("/api/unknown", { headers: { Accept: "text/html" } });
  assert.equal(api404.status, 404);
  assert.equal(typeof api404.body.error, "string");
});
