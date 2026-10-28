import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { pathToFileURL } from "node:url";
import { createAdminRecord, DEFAULT_DATA_DIR } from "./auth.js";

function setupError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function checkExistingTarget(target, reset) {
  try {
    const stat = await fs.lstat(target);
    if (!reset) throw setupError("ADMIN_EXISTS", "管理员已存在；不会覆盖。如需重置，请显式传入 --reset。");
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw setupError("ADMIN_PATH_INVALID", "管理员配置必须是普通文件；拒绝覆盖目录或符号链接。");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

/** Offline-only provisioning; atomic creation refuses an existing account even under races. */
export async function setupAdmin({ dataDir = DEFAULT_DATA_DIR, username, password, reset = false } = {}) {
  if (typeof reset !== "boolean") throw new TypeError("reset must be a boolean");
  const directory = path.resolve(dataDir);
  const target = path.join(directory, "admin.json");
  await checkExistingTarget(target, reset);
  const record = await createAdminRecord({ username, password });
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = path.join(directory, `.admin-${randomBytes(16).toString("hex")}.tmp`);
  let handle;
  let temporaryExists = false;
  try {
    handle = await fs.open(temporary, "wx", 0o600);
    temporaryExists = true;
    await handle.writeFile(`${JSON.stringify(record, null, 2)}\n`, "utf8");
    await handle.chmod(0o600);
    await handle.sync();
    await handle.close();
    handle = null;
    if (reset) {
      // Recheck the destination immediately before replacement; never follow a symlink.
      await checkExistingTarget(target, true);
      await fs.rename(temporary, target);
      temporaryExists = false;
    } else {
      try {
        // link() is atomic and, unlike rename(), cannot replace an existing account.
        await fs.link(temporary, target);
      } catch (error) {
        if (error.code === "EEXIST") {
          throw setupError("ADMIN_EXISTS", "管理员已存在；不会覆盖。如需重置，请显式传入 --reset。");
        }
        throw error;
      }
    }
  } finally {
    if (handle) await handle.close();
    if (temporaryExists) await fs.unlink(temporary);
  }
  return { username: record.username };
}

// The readline display sink is muted for password prompts; passwords never reach stdout/history.
class PromptOutput extends Writable {
  constructor(output) {
    super();
    this.output = output;
    this.muted = false;
    this.isTTY = output.isTTY;
    this.columns = output.columns;
  }

  _write(chunk, encoding, callback) {
    if (this.muted) callback();
    else this.output.write(chunk, encoding, callback);
  }
}

async function promptCredentials(username, password) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw setupError("INTERACTIVE_REQUIRED", "非交互模式请提供 ADMIN_USERNAME 和 ADMIN_PASSWORD 环境变量。");
  }
  const output = new PromptOutput(process.stdout);
  const rl = createInterface({ input: process.stdin, output, terminal: true, historySize: 0 });
  const abort = new AbortController();
  rl.on("SIGINT", () => abort.abort());
  rl.on("close", () => abort.abort());
  async function hiddenQuestion(label) {
    process.stdout.write(label);
    output.muted = true;
    try {
      return await rl.question("", { signal: abort.signal });
    } finally {
      output.muted = false;
      process.stdout.write("\n");
    }
  }
  try {
    if (username === undefined) username = await rl.question("管理员用户名（3–64 个字符）：", { signal: abort.signal });
    if (password === undefined) {
      password = await hiddenQuestion("管理员密码（12–128 个字符，输入隐藏）：");
      const confirmation = await hiddenQuestion("再次输入密码（输入隐藏）：");
      if (password !== confirmation) throw setupError("PASSWORD_MISMATCH", "两次密码不一致；未写入任何账号。");
    }
    return { username, password };
  } catch (error) {
    if (error.name === "AbortError") throw setupError("SETUP_CANCELLED", "已取消管理员设置。");
    throw error;
  } finally {
    rl.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    process.stdout.write("用法：node server/setup-admin.js [--reset]\n默认数据目录为 server/data；可用 DATA_DIR 指定目录。\n交互输入用户名及隐藏密码，或设置 ADMIN_USERNAME / ADMIN_PASSWORD。\n已有管理员不会覆盖，只有显式 --reset 才允许重置；完成后请重启后端。\n");
    return;
  }
  if (args.some((arg) => arg !== "--reset")) throw setupError("INVALID_ARGUMENT", "未知参数。请使用 --help 查看用法。");
  const reset = args.includes("--reset");
  const dataDir = process.env.DATA_DIR || DEFAULT_DATA_DIR;
  await checkExistingTarget(path.join(path.resolve(dataDir), "admin.json"), reset);
  let username = process.env.ADMIN_USERNAME;
  let password = process.env.ADMIN_PASSWORD;
  if (username === undefined || password === undefined) {
    ({ username, password } = await promptCredentials(username, password));
  }
  const result = await setupAdmin({ dataDir, username, password, reset });
  process.stdout.write(`管理员${reset ? "已重置" : "已创建"}：${result.username}。请重启后端使其生效。\n`);
}

const publicErrorCodes = new Set([
  "ADMIN_EXISTS", "ADMIN_PATH_INVALID", "INVALID_CREDENTIALS", "INTERACTIVE_REQUIRED",
  "PASSWORD_MISMATCH", "SETUP_CANCELLED", "INVALID_ARGUMENT",
]);
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    const message = publicErrorCodes.has(error.code)
      ? error.message
      : "无法安全保存管理员配置；请检查数据目录及权限。";
    process.stderr.write(`管理员设置失败：${message}\n`);
    process.exitCode = 1;
  });
}
