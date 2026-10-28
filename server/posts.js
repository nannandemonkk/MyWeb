import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import matter from "gray-matter";
import { HttpError } from "./errors.js";
import { parseMeta } from "./post-meta.js";
import { dateKey, parsePostDate } from "../src/lib/posts.js";

const MAX_CONTENT_BYTES = 512 * 1024;
const TYPES = new Set(["note", "log", "plan", "uncategorized"]);
const STATUSES = new Set(["draft", "published"]);
const RESERVED_NAME = /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i;

export function validateSlug(slug) {
  // Single, portable filename: disallow Windows devices/ADS, traversal and hidden files.
  if (typeof slug !== "string" || !/^[\p{L}\p{N}][\p{L}\p{N} _.-]{0,119}$/u.test(slug) ||
      Buffer.byteLength(slug, "utf8") > 200 || slug.includes("..") || /[. ]$/.test(slug) ||
      /\.md$/i.test(slug) || RESERVED_NAME.test(slug)) {
    throw new HttpError(400, "文章链接不合法：请使用中英文、数字、短横线或下划线，不要包含路径。");
  }
  return slug;
}

export function validatePost(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new HttpError(400, "请提交文章对象。");
  if (typeof input.title !== "string" || !input.title.trim() || input.title.trim().length > 200) {
    throw new HttpError(400, "标题不能为空，且不能超过 200 个字符。");
  }
  if (typeof input.content !== "string" || Buffer.byteLength(input.content, "utf8") > MAX_CONTENT_BYTES) {
    throw new HttpError(400, "正文必须是文本，且不能超过 512 KiB。");
  }
  if (!STATUSES.has(input.status)) throw new HttpError(400, "文章状态只能是 draft 或 published。");
  if (input.status === "published" && !input.content.trim()) throw new HttpError(400, "发布前请填写正文。");
  if (!TYPES.has(input.type)) throw new HttpError(400, "文章分类不合法。");
  const date = input.date ?? "";
  if (typeof date !== "string" || (date !== "" && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !parsePostDate(date)))) {
    throw new HttpError(400, "日期必须是真实的 YYYY-MM-DD 日期，或留空。");
  }
  if (!Array.isArray(input.tags) || input.tags.length > 20 ||
      input.tags.some((tag) => typeof tag !== "string" || !tag.trim() || tag.trim().length > 40)) {
    throw new HttpError(400, "最多 20 个标签，每个标签为 1–40 个字符。");
  }
  const excerpt = input.excerpt ?? "";
  if (typeof excerpt !== "string" || excerpt.length > 500) throw new HttpError(400, "自定义摘要不能超过 500 个字符。");
  if (typeof input.pinned !== "boolean") throw new HttpError(400, "置顶状态必须是布尔值。");
  return {
    title: input.title.trim(), content: input.content, date, type: input.type,
    tags: [...new Set(input.tags.map((tag) => tag.trim()))],
    excerpt: excerpt.trim(), pinned: input.pinned, status: input.status,
  };
}

function parseDocument(raw) {
  // gray-matter also ships an executable JavaScript engine. Never let a file select it.
  const text = raw.replace(/^\uFEFF/, "");
  if (matter.test(text)) {
    const language = matter.language(text).name.toLowerCase();
    if (language && !["yaml", "yml", "json"].includes(language)) throw new Error("Unsupported front matter language");
  }
  const parsed = matter(text, {}); // Passing options disables gray-matter's unbounded content cache.
  if (!parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) {
    throw new Error("Front matter must be an object");
  }
  return parsed;
}

async function atomicWrite(filename, raw, { exclusive = false } = {}) {
  const resolved = path.resolve(filename);
  const temporary = path.join(path.dirname(resolved), `.${path.basename(resolved)}.${randomBytes(8).toString("hex")}.tmp`);
  if (path.dirname(temporary) !== path.dirname(resolved)) throw new Error("Unsafe temporary path");
  try {
    await fs.writeFile(temporary, raw, { flag: "wx", mode: 0o600 });
    // A hard link publishes a completely written new file atomically and never replaces a collision.
    if (exclusive) await fs.link(temporary, resolved);
    else await fs.rename(temporary, resolved);
  } finally {
    // The temporary name was verified above to share the destination directory.
    await fs.rm(temporary, { force: true });
  }
}

function serialize(fields, previousData = {}) {
  const preserved = Object.fromEntries(Object.entries(previousData).filter(([key]) => !["__proto__", "constructor", "prototype"].includes(key)));
  const data = { ...preserved, ...fields, updatedAt: new Date().toISOString() };
  delete data.content;
  // An explicit blank suppresses date inference for deliberately undated edited articles.
  if (!fields.excerpt) delete data.excerpt;
  // Pass an object, not a string: a Markdown body starting with --- must never be reparsed as metadata.
  return matter.stringify({ content: fields.content, data: {} }, data);
}

function versionOf(raw, status) {
  return createHash("sha256").update(status).update("\0").update(raw).digest("hex");
}

function requireVersion(inputVersion, currentVersion) {
  if (typeof inputVersion !== "string" || !inputVersion) throw new HttpError(428, "缺少文章版本，请重新打开编辑页后再试。");
  if (inputVersion !== currentVersion) throw new HttpError(409, "文章已被其他页面或本地文件修改。请先备份当前内容，再重新加载，避免覆盖。");
}

function newestFirst(a, b) {
  const left = parsePostDate(a.date)?.valueOf() ?? -Infinity;
  const right = parsePostDate(b.date)?.valueOf() ?? -Infinity;
  return (right === left ? 0 : right > left ? 1 : -1) || a.slug.localeCompare(b.slug, "zh-CN");
}

/** A single-process file store. Writes and reads share a queue to prevent lost updates. */
export async function createPostStore({ docsDir, draftsDir, logger = console } = {}) {
  if (!docsDir || !draftsDir) throw new Error("docsDir and draftsDir are required");
  docsDir = path.resolve(docsDir);
  draftsDir = path.resolve(draftsDir);
  await Promise.all([fs.mkdir(docsDir, { recursive: true }), fs.mkdir(draftsDir, { recursive: true, mode: 0o700 })]);
  [docsDir, draftsDir] = await Promise.all([fs.realpath(docsDir), fs.realpath(draftsDir)]);
  if (path.relative(docsDir, draftsDir) === "") throw new Error("草稿目录不能与公开文章目录指向同一位置。");
  const [docsStat, draftsStat] = await Promise.all([fs.stat(docsDir), fs.stat(draftsDir)]);
  if (docsStat.dev !== draftsStat.dev) throw new Error("公开文章与草稿目录必须位于同一文件系统，以安全发布和撤回文章。");
  let pending = Promise.resolve();
  function locked(task) {
    const result = pending.then(task);
    pending = result.catch(() => {});
    return result;
  }

  function filename(dir, slug) {
    validateSlug(slug);
    const resolved = path.resolve(dir, `${slug}.md`);
    if (path.dirname(resolved) !== dir) throw new HttpError(400, "非法的文章路径。");
    return resolved;
  }

  async function readEntry(dir, slug, locationStatus) {
    const file = filename(dir, slug);
    let stat;
    let raw;
    try {
      stat = await fs.lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new HttpError(404, "文章不存在。");
      raw = await fs.readFile(file, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
    let parsed;
    try { parsed = parseDocument(raw); } catch { throw new HttpError(422, "文章元数据损坏，请先在服务器修复该 Markdown 文件。"); }
    // Only missing legacy status or an explicit published value can be public; typos must fail closed.
    if (Object.hasOwn(parsed.data, "status") && !STATUSES.has(parsed.data.status)) {
      throw new HttpError(422, "文章状态无效，请在服务器修复为 draft 或 published。");
    }
    const status = locationStatus === "draft" || parsed.data.status === "draft" ? "draft" : "published";
    const meta = parseMeta(slug, parsed);
    const normalizedDate = parsePostDate(meta.date);
    return {
      file, raw, parsed, locationStatus,
      public: { slug, ...meta },
      admin: {
        slug, ...meta, date: normalizedDate ? dateKey(normalizedDate) : "", status,
        version: versionOf(raw, status), updatedAt: stat.mtime.toISOString(),
        content: parsed.content,
        customExcerpt: typeof parsed.data.excerpt === "string" ? parsed.data.excerpt : "",
      },
    };
  }

  async function find(slug) {
    validateSlug(slug);
    const [published, draft] = await Promise.all([readEntry(docsDir, slug, "published"), readEntry(draftsDir, slug, "draft")]);
    if (published && draft) throw new HttpError(409, "公开目录与草稿目录存在同名文章，请在服务器解决冲突。");
    return published || draft;
  }

  async function listEntries(dir, status) {
    const files = await fs.readdir(dir, { withFileTypes: true });
    const entries = [];
    for (const entry of files) {
      if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith(".md")) continue;
      const slug = entry.name.slice(0, -3);
      try {
        const document = await readEntry(dir, slug, status);
        if (document) entries.push(document);
      } catch (error) {
        // One malformed/unreadable document must not break every other article.
        logger.warn?.(`跳过无法读取的文章 ${entry.name}: ${error.message}`);
      }
    }
    return entries;
  }

  return {
    listPublic: () => locked(async () => (await listEntries(docsDir, "published"))
      .filter((entry) => entry.admin.status === "published").map((entry) => entry.public).sort(newestFirst)),
    getPublic: (slug) => locked(async () => {
      const entry = await readEntry(docsDir, slug, "published");
      if (!entry || entry.admin.status !== "published") throw new HttpError(404, "文章不存在。");
      return { ...entry.public, content: entry.parsed.content };
    }),
    listAdmin: (status = "all") => locked(async () => {
      if (!["all", "draft", "published"].includes(status)) throw new HttpError(400, "无效的文章状态筛选。");
      const entries = [...await listEntries(docsDir, "published"), ...await listEntries(draftsDir, "draft")];
      const seen = new Set();
      for (const entry of entries) {
        if (seen.has(entry.admin.slug)) throw new HttpError(409, "公开目录与草稿目录存在同名文章，请先解决冲突。");
        seen.add(entry.admin.slug);
      }
      return entries.map(({ admin }) => {
        const summary = { ...admin };
        delete summary.content;
        delete summary.customExcerpt;
        return summary;
      }).filter((entry) => status === "all" || entry.status === status)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.slug.localeCompare(b.slug, "zh-CN"));
    }),
    getAdmin: (slug) => locked(async () => {
      const entry = await find(slug);
      if (!entry) throw new HttpError(404, "文章不存在。");
      return entry.admin;
    }),
    create: (input) => locked(async () => {
      const fields = validatePost(input);
      let slug = input.slug;
      if (slug !== undefined && slug !== "") validateSlug(slug);
      else slug = `${dateKey(new Date())}-${randomBytes(6).toString("hex")}`;
      if (await find(slug)) throw new HttpError(409, "这个文章链接已存在，请换一个。");
      const dir = fields.status === "published" ? docsDir : draftsDir;
      const file = filename(dir, slug);
      const raw = serialize(fields);
      try { await atomicWrite(file, raw, { exclusive: true }); } catch (error) {
        if (error.code === "EEXIST") throw new HttpError(409, "这个文章链接已存在，请换一个。");
        throw error;
      }
      return (await readEntry(dir, slug, fields.status)).admin;
    }),
    update: (slug, input) => locked(async () => {
      const fields = validatePost(input);
      const entry = await find(slug);
      if (!entry) throw new HttpError(404, "文章不存在。");
      requireVersion(input.version, entry.admin.version);
      if (input.slug !== undefined && input.slug !== slug) throw new HttpError(400, "已有文章的链接不可修改。");
      const targetDir = fields.status === "published" ? docsDir : draftsDir;
      const targetFile = filename(targetDir, slug);
      const raw = serialize(fields, entry.parsed.data);
      // Rewrite source first. A withdrawal's status:draft immediately hides it from public APIs,
      // even if the process stops before the subsequent exclusive transfer to the draft directory.
      await atomicWrite(entry.file, raw);
      if (entry.file !== targetFile) {
        let linked = false;
        try {
          // rename() can silently overwrite a file manually created since find(). link() cannot.
          // Both configured directories have already been verified to share a filesystem.
          await fs.link(entry.file, targetFile);
          linked = true;
          await fs.unlink(entry.file);
        } catch (error) {
          if (linked) {
            const [sourceStat, targetStat] = await Promise.all([fs.lstat(entry.file), fs.lstat(targetFile)]);
            if (sourceStat.dev !== targetStat.dev || sourceStat.ino !== targetStat.ino || targetStat.isSymbolicLink()) throw error;
            // This target is the exact hard link just created here, not a pre-existing article.
            await fs.unlink(targetFile);
          }
          // A failed withdrawal must remain hidden rather than re-exposing the previous publication.
          if (fields.status !== "draft") await atomicWrite(entry.file, entry.raw);
          if (error.code === "EEXIST") throw new HttpError(409, "目标目录已出现同名文章，未覆盖任何文件。请先解决文件冲突。");
          if (fields.status === "draft") throw new HttpError(503, "文章已停止公开，但草稿转移失败。请先备份并检查目录权限，再重新加载文章。");
          throw error;
        }
      }
      return (await readEntry(targetDir, slug, fields.status)).admin;
    }),
    delete: (slug, inputVersion) => locked(async () => {
      const entry = await find(slug);
      if (!entry) throw new HttpError(404, "文章不存在。");
      requireVersion(inputVersion, entry.admin.version);
      // readEntry/filename established that this is a regular file in exactly one configured directory.
      const resolved = path.resolve(entry.file);
      if (![docsDir, draftsDir].includes(path.dirname(resolved))) throw new Error("Unsafe deletion path");
      await fs.unlink(resolved);
    }),
  };
}
