import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import express from "express";
import { AUTH_COOKIE_NAME, createAdminRecord, createAuth, DEFAULT_DATA_DIR } from "./auth.js";
import { setupAdmin } from "./setup-admin.js";

// Every account, server, CLI output and configuration below is confined to a disposable directory.
// No real server/data or document path is read or modified by this suite.
const deriveKey = promisify(scrypt);
const credentials = () => ({ username: "test-admin", password: randomBytes(24).toString("base64url") });

async function temporaryDirectory(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "myweb-auth-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

async function provision(t) {
  const dataDir = await temporaryDirectory(t);
  const account = credentials();
  await setupAdmin({ dataDir, ...account });
  return { dataDir, account };
}

async function application(t, options) {
  const auth = await createAuth(options);
  const app = express();
  // Even if a parent app trusts a reverse proxy, spoofed forwarding headers cannot bypass our limiter.
  app.set("trust proxy", true);
  app.use(express.json({ limit: "16kb" }));
  app.use("/api", auth.middleware);
  app.use("/api/auth", auth.router);
  app.get("/api/admin/protected", auth.requireAuth, (req, res) => res.json(req.auth));
  app.get("/api/admin/safe", auth.requireAuth, auth.requireCsrf, (_req, res) => res.json({ ok: true }));
  for (const method of ["post", "put", "patch", "delete"]) {
    app[method]("/api/admin/protected", auth.requireAuth, auth.requireCsrf, (_req, res) => res.json({ ok: true }));
  }
  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return async function request(method, route, { body, cookie, csrfToken, headers = {} } = {}) {
    const response = await fetch(`${origin}${route}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(csrfToken !== undefined ? { "X-CSRF-Token": csrfToken } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : null };
  };
}

function cookieFrom(response) {
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie, "login/logout should set a cookie");
  return cookie.split(";")[0];
}

function assertNoStore(response) {
  assert.equal(response.headers.get("cache-control"), "no-store");
}

async function runCli(root, dataDir, account, args = []) {
  const stdoutPath = path.join(root, `stdout-${randomBytes(8).toString("hex")}.txt`);
  const stderrPath = path.join(root, `stderr-${randomBytes(8).toString("hex")}.txt`);
  const stdout = await fs.open(stdoutPath, "wx", 0o600);
  const stderr = await fs.open(stderrPath, "wx", 0o600);
  let result;
  try {
    const env = { ...process.env, DATA_DIR: dataDir };
    delete env.ADMIN_USERNAME;
    delete env.ADMIN_PASSWORD;
    if (account?.username !== undefined) env.ADMIN_USERNAME = account.username;
    if (account?.password !== undefined) env.ADMIN_PASSWORD = account.password;
    // File descriptors, rather than captured pipes, also work in the Windows file sandbox.
    result = spawnSync(process.execPath, [fileURLToPath(new URL("./setup-admin.js", import.meta.url)), ...args], {
      cwd: root,
      env,
      stdio: ["ignore", stdout.fd, stderr.fd],
      timeout: 30000,
      windowsHide: true,
    });
  } finally {
    await stdout.close();
    await stderr.close();
  }
  if (result.error) throw result.error;
  return { status: result.status, output: `${await fs.readFile(stdoutPath, "utf8")}${await fs.readFile(stderrPath, "utf8")}` };
}

test("setup persists only a salted scrypt hash, uses fresh salts, and cleans atomic temporary files", async (t) => {
  const root = await temporaryDirectory(t);
  const dataDir = path.join(root, "first");
  const secondDir = path.join(root, "second");
  const account = credentials();
  assert.deepEqual(await setupAdmin({ dataDir, ...account }), { username: account.username });
  await setupAdmin({ dataDir: secondDir, ...account });
  const raw = await fs.readFile(path.join(dataDir, "admin.json"), "utf8");
  const record = JSON.parse(raw);
  const second = JSON.parse(await fs.readFile(path.join(secondDir, "admin.json"), "utf8"));
  assert.equal(record.version, 1);
  assert.equal(record.username, account.username);
  assert.equal(record.password.algorithm, "scrypt");
  assert.equal(raw.includes(account.password), false);
  assert.notEqual(record.password.salt, second.password.salt);
  assert.notEqual(record.password.hash, second.password.hash);
  const key = await deriveKey(account.password, Buffer.from(record.password.salt, "base64url"), record.password.keyLength, {
    N: record.password.N, r: record.password.r, p: record.password.p, maxmem: 64 * 1024 * 1024,
  });
  assert.equal(timingSafeEqual(key, Buffer.from(record.password.hash, "base64url")), true);
  assert.deepEqual(await fs.readdir(dataDir), ["admin.json"]);
  if (process.platform !== "win32") {
    assert.equal((await fs.stat(path.join(dataDir, "admin.json"))).mode & 0o777, 0o600);
    assert.equal((await fs.stat(dataDir)).mode & 0o777, 0o700);
  }
  assert.equal(DEFAULT_DATA_DIR, fileURLToPath(new URL("./data/", import.meta.url)));
});

test("setup validates credential limits, refuses overwrite, and only resets explicitly", async (t) => {
  const dataDir = await temporaryDirectory(t);
  const account = credentials();
  for (const invalid of [
    { username: "ab" }, { username: "a".repeat(65) }, { username: "has spaces" },
    { username: "-admin" }, { password: "short" }, { password: "a".repeat(129) }, { password: 42 },
  ]) {
    await assert.rejects(setupAdmin({ dataDir, ...account, ...invalid }), { code: "INVALID_CREDENTIALS" });
  }
  assert.deepEqual(await fs.readdir(dataDir), []);
  await createAdminRecord({ username: "a".repeat(64), password: randomBytes(96).toString("base64url") });
  await createAdminRecord({ username: "abc", password: randomBytes(9).toString("base64url") });
  await setupAdmin({ dataDir, ...account });
  const before = await fs.readFile(path.join(dataDir, "admin.json"), "utf8");
  const replacement = { username: "replacement-admin", password: randomBytes(24).toString("base64url") };
  await assert.rejects(setupAdmin({ dataDir, ...replacement }), { code: "ADMIN_EXISTS" });
  assert.equal(await fs.readFile(path.join(dataDir, "admin.json"), "utf8"), before);
  await setupAdmin({ dataDir, ...replacement, reset: true });
  assert.notEqual(await fs.readFile(path.join(dataDir, "admin.json"), "utf8"), before);
  const request = await application(t, { dataDir });
  assert.equal((await request("POST", "/api/auth/login", { body: account })).status, 401);
  assert.equal((await request("POST", "/api/auth/login", { body: replacement })).status, 200);
});

test("simultaneous first-time setup cannot overwrite the winning account", async (t) => {
  const dataDir = await temporaryDirectory(t);
  const results = await Promise.allSettled([
    setupAdmin({ dataDir, ...credentials() }),
    setupAdmin({ dataDir, username: "other-admin", password: randomBytes(24).toString("base64url") }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.find((result) => result.status === "rejected").reason.code, "ADMIN_EXISTS");
  assert.deepEqual(await fs.readdir(dataDir), ["admin.json"]);
});

test("an unconfigured server exposes status but never creates an admin through login", async (t) => {
  const dataDir = await temporaryDirectory(t);
  const request = await application(t, { dataDir });
  const session = await request("GET", "/api/auth/session");
  assert.equal(session.status, 200);
  assert.deepEqual(session.body, { user: null, csrfToken: null, configured: false });
  assertNoStore(session);
  const login = await request("POST", "/api/auth/login", { body: credentials() });
  assert.equal(login.status, 503);
  assert.match(login.body.error, /npm run admin:setup/);
  assert.equal(login.headers.get("set-cookie"), null);
  assertNoStore(login);
  assert.deepEqual(await fs.readdir(dataDir), []);
  const unauthorized = await request("GET", "/api/admin/protected");
  assert.equal(unauthorized.status, 401);
  assertNoStore(unauthorized);
});

test("login and session use the fixed public shape and a 12h HttpOnly SameSite cookie", async (t) => {
  const { dataDir, account } = await provision(t);
  const request = await application(t, { dataDir });
  const login = await request("POST", "/api/auth/login", { body: account });
  assert.equal(login.status, 200);
  assert.deepEqual(Object.keys(login.body).sort(), ["configured", "csrfToken", "user"]);
  assert.deepEqual(login.body.user, { username: account.username });
  assert.equal(login.body.configured, true);
  assert.match(login.body.csrfToken, /^[A-Za-z0-9_-]{43}$/);
  const setCookie = login.headers.get("set-cookie");
  assert.match(setCookie, new RegExp(`^${AUTH_COOKIE_NAME}=[A-Za-z0-9_-]{43};`));
  assert.match(setCookie, /; HttpOnly(?:;|$)/);
  assert.match(setCookie, /; SameSite=Lax(?:;|$)/);
  assert.match(setCookie, /; Path=\/api(?:;|$)/);
  assert.match(setCookie, /; Max-Age=43200(?:;|$)/);
  assert.doesNotMatch(setCookie, /; Secure(?:;|$)/);
  assertNoStore(login);
  const cookie = cookieFrom(login);
  const session = await request("GET", "/api/auth/session", { cookie });
  assert.deepEqual(session.body, login.body);
  assertNoStore(session);
  const protectedResponse = await request("GET", "/api/admin/protected", { cookie });
  assert.equal(protectedResponse.status, 200);
  assert.deepEqual(protectedResponse.body, { user: login.body.user, csrfToken: login.body.csrfToken });
  assert.equal(JSON.stringify(session.body).includes(account.password), false);
  assert.equal(JSON.stringify(session.body).includes("scrypt"), false);
  const forged = await request("GET", "/api/admin/protected", { cookie: `${AUTH_COOKIE_NAME}=${randomBytes(32).toString("base64url")}` });
  assert.equal(forged.status, 401);
  const duplicate = await request("GET", "/api/admin/protected", { cookie: `${cookie}; ${cookie}` });
  assert.equal(duplicate.status, 401);
});

test("wrong username, wrong password and invalid input all return the same bounded login error", async (t) => {
  const { dataDir, account } = await provision(t);
  const request = await application(t, { dataDir });
  let expected;
  for (const body of [
    { ...account, username: "does-not-exist" },
    { ...account, password: randomBytes(24).toString("base64url") },
    {}, [], { ...account, password: "x".repeat(129) },
    { ...account, username: [account.username] },
    { ...account, password: "" }, { ...account, password: 42 },
  ]) {
    const response = await request("POST", "/api/auth/login", { body });
    assert.equal(response.status, 401);
    expected ??= response.body;
    assert.deepEqual(response.body, expected);
    assert.equal(response.headers.get("set-cookie"), null);
    assertNoStore(response);
  }
});

test("login throttles the real socket address, not X-Forwarded-For, and windows expire", async (t) => {
  const { dataDir, account } = await provision(t);
  let time = 1000;
  const request = await application(t, { dataDir, now: () => time, loginRateLimit: 2, loginWindowMs: 5000 });
  for (const forwarded of ["192.0.2.1", "192.0.2.2"]) {
    const response = await request("POST", "/api/auth/login", {
      body: { ...account, password: randomBytes(24).toString("base64url") },
      headers: { "X-Forwarded-For": forwarded },
    });
    assert.equal(response.status, 401);
  }
  const limited = await request("POST", "/api/auth/login", { body: account, headers: { "X-Forwarded-For": "192.0.2.3" } });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "5");
  assert.equal(limited.headers.get("set-cookie"), null);
  assertNoStore(limited);
  time += 5000;
  assert.equal((await request("POST", "/api/auth/login", { body: account })).status, 200);
});

test("concurrent password work is bounded independently of the per-address window", async (t) => {
  const { dataDir, account } = await provision(t);
  const request = await application(t, { dataDir, maxConcurrentLogins: 1 });
  const responses = await Promise.all(Array.from({ length: 4 }, () => request("POST", "/api/auth/login", { body: account })));
  assert.equal(responses.filter((response) => response.status === 200).length, 1);
  assert.equal(responses.filter((response) => response.status === 429).length, 3);
  for (const response of responses) assertNoStore(response);
});

test("sessions expire at a fixed TTL without sliding renewal", async (t) => {
  const { dataDir, account } = await provision(t);
  let time = 1000;
  const request = await application(t, { dataDir, now: () => time, sessionTtlMs: 1000 });
  const login = await request("POST", "/api/auth/login", { body: account });
  const cookie = cookieFrom(login);
  time = 1999;
  assert.equal((await request("GET", "/api/admin/protected", { cookie })).status, 200);
  time = 2000;
  assert.deepEqual((await request("GET", "/api/auth/session", { cookie })).body, { user: null, csrfToken: null, configured: true });
  assert.equal((await request("GET", "/api/admin/protected", { cookie })).status, 401);
  assert.equal((await request("POST", "/api/auth/logout", { cookie, csrfToken: login.body.csrfToken })).status, 401);
});

test("CSRF protects unsafe admin methods and logout, which revokes and clears a Secure cookie", async (t) => {
  const { dataDir, account } = await provision(t);
  const request = await application(t, { dataDir, secureCookies: true });
  const login = await request("POST", "/api/auth/login", { body: account });
  const cookie = cookieFrom(login);
  const csrfToken = login.body.csrfToken;
  assert.match(login.headers.get("set-cookie"), /; Secure(?:;|$)/);
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const forbidden = await request(method, "/api/admin/protected", { cookie });
    assert.equal(forbidden.status, 403);
    assertNoStore(forbidden);
    assert.equal((await request(method, "/api/admin/protected", { cookie, csrfToken: "incorrect" })).status, 403);
    assert.equal((await request(method, "/api/admin/protected", { cookie, csrfToken })).status, 200);
  }
  assert.equal((await request("GET", "/api/admin/safe", { cookie })).status, 200);
  assert.equal((await request("POST", "/api/auth/logout", { cookie })).status, 403);
  assert.equal((await request("POST", "/api/auth/logout", { cookie, csrfToken: "incorrect" })).status, 403);
  assert.equal((await request("GET", "/api/admin/protected", { cookie })).status, 200);
  const logout = await request("POST", "/api/auth/logout", { cookie, csrfToken });
  assert.equal(logout.status, 204);
  assert.equal(logout.body, null);
  assertNoStore(logout);
  const clearingCookie = logout.headers.get("set-cookie");
  assert.equal(cookieFrom(logout), `${AUTH_COOKIE_NAME}=`);
  assert.match(clearingCookie, /; Expires=Thu, 01 Jan 1970/);
  assert.match(clearingCookie, /; Path=\/api(?:;|$)/);
  assert.match(clearingCookie, /; HttpOnly(?:;|$)/);
  assert.match(clearingCookie, /; Secure(?:;|$)/);
  assert.match(clearingCookie, /; SameSite=Lax(?:;|$)/);
  assert.equal((await request("GET", "/api/admin/protected", { cookie })).status, 401);
  assert.equal((await request("POST", "/api/auth/logout", { cookie, csrfToken })).status, 401);
});

test("successful login rotates the existing session and CSRF token; failure does not", async (t) => {
  const { dataDir, account } = await provision(t);
  const request = await application(t, { dataDir });
  const first = await request("POST", "/api/auth/login", { body: account });
  const oldCookie = cookieFrom(first);
  const second = await request("POST", "/api/auth/login", { body: account, cookie: oldCookie });
  const cookie = cookieFrom(second);
  assert.notEqual(cookie, oldCookie);
  assert.notEqual(first.body.csrfToken, second.body.csrfToken);
  assert.equal((await request("GET", "/api/admin/protected", { cookie: oldCookie })).status, 401);
  assert.equal((await request("POST", "/api/admin/protected", { cookie, csrfToken: first.body.csrfToken })).status, 403);
  assert.equal((await request("POST", "/api/admin/protected", { cookie, csrfToken: second.body.csrfToken })).status, 200);
  const failed = await request("POST", "/api/auth/login", {
    body: { ...account, password: randomBytes(24).toString("base64url") }, cookie,
  });
  assert.equal(failed.status, 401);
  assert.deepEqual((await request("GET", "/api/auth/session", { cookie })).body, second.body);
});

test("session capacity evicts the oldest session and expired entries do not remain authenticated", async (t) => {
  const { dataDir, account } = await provision(t);
  let time = 1000;
  const request = await application(t, { dataDir, maxSessions: 2, sessionTtlMs: 1000, now: () => time });
  const cookies = [];
  for (let index = 0; index < 3; index += 1) {
    cookies.push(cookieFrom(await request("POST", "/api/auth/login", { body: account })));
    time += 1;
  }
  assert.equal((await request("GET", "/api/admin/protected", { cookie: cookies[0] })).status, 401);
  assert.equal((await request("GET", "/api/admin/protected", { cookie: cookies[1] })).status, 200);
  assert.equal((await request("GET", "/api/admin/protected", { cookie: cookies[2] })).status, 200);
  time = 2002;
  assert.equal((await request("GET", "/api/admin/protected", { cookie: cookies[1] })).status, 401);
  assert.equal((await request("GET", "/api/admin/protected", { cookie: cookies[2] })).status, 401);
});

test("a fresh auth instance reloads the persisted hash but rejects sessions from another instance", async (t) => {
  const { dataDir, account } = await provision(t);
  const first = await application(t, { dataDir });
  const login = await first("POST", "/api/auth/login", { body: account });
  const cookie = cookieFrom(login);
  const restarted = await application(t, { dataDir });
  assert.equal((await restarted("GET", "/api/admin/protected", { cookie })).status, 401);
  assert.equal((await restarted("POST", "/api/auth/login", { body: account })).status, 200);
  assert.deepEqual(await fs.readdir(dataDir), ["admin.json"]);
});

test("malformed or weakened persisted hashes fail closed, and explicit offline reset can repair them", async (t) => {
  const dataDir = await temporaryDirectory(t);
  const target = path.join(dataDir, "admin.json");
  await fs.writeFile(target, "{", { mode: 0o600 });
  await assert.rejects(createAuth({ dataDir }), /管理员配置无效/);
  const account = credentials();
  const record = await createAdminRecord(account);
  await fs.writeFile(target, JSON.stringify({ ...record, password: { ...record.password, N: 2 ** 30 } }));
  await assert.rejects(createAuth({ dataDir }), /管理员配置无效/);
  await assert.rejects(setupAdmin({ dataDir, ...account }), { code: "ADMIN_EXISTS" });
  await setupAdmin({ dataDir, ...account, reset: true });
  const request = await application(t, { dataDir });
  assert.equal((await request("POST", "/api/auth/login", { body: account })).status, 200);
});

test("CLI honors DATA_DIR and environment credentials, refuses overwrite, and never prints secrets", async (t) => {
  const root = await temporaryDirectory(t);
  const dataDir = path.join(root, "cli-data");
  const account = credentials();
  const first = await runCli(root, dataDir, account);
  assert.equal(first.status, 0);
  assert.match(first.output, /已创建/);
  assert.equal(first.output.includes(account.password), false);
  const before = await fs.readFile(path.join(dataDir, "admin.json"), "utf8");
  const record = JSON.parse(before);
  assert.equal(first.output.includes(record.password.hash), false);
  const replacement = { username: "cli-replacement", password: randomBytes(24).toString("base64url") };
  const refusal = await runCli(root, dataDir, replacement);
  assert.equal(refusal.status, 1);
  assert.match(refusal.output, /--reset/);
  assert.equal(await fs.readFile(path.join(dataDir, "admin.json"), "utf8"), before);
  const reset = await runCli(root, dataDir, replacement, ["--reset"]);
  assert.equal(reset.status, 0);
  assert.match(reset.output, /已重置/);
  assert.equal(reset.output.includes(replacement.password), false);
  const replacedRecord = JSON.parse(await fs.readFile(path.join(dataDir, "admin.json"), "utf8"));
  assert.equal(replacedRecord.username, replacement.username);
  assert.equal(reset.output.includes(replacedRecord.password.hash), false);
  const missingEnv = await runCli(root, path.join(root, "missing-env"));
  assert.equal(missingEnv.status, 1);
  assert.match(missingEnv.output, /ADMIN_USERNAME/);
  await assert.rejects(fs.stat(path.join(root, "missing-env", "admin.json")), { code: "ENOENT" });
});
