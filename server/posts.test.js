import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { createPostStore, validatePost, validateSlug } from "./posts.js";

async function fixture(t) {
  const parent = path.resolve(import.meta.dirname, "../artifacts/test-runs");
  await fs.mkdir(parent, { recursive: true });
  const root = await fs.mkdtemp(path.join(parent, "posts-"));
  t.after(async () => {
    assert.equal(path.dirname(root), parent);
    assert.ok(path.basename(root).startsWith("posts-"));
    await fs.rm(root, { recursive: true, force: true });
  });
  const docsDir = path.join(root, "document");
  const draftsDir = path.join(root, "private-drafts");
  const warnings = [];
  const store = await createPostStore({ docsDir, draftsDir, logger: { warn: (message) => warnings.push(message) } });
  return { store, docsDir, draftsDir, warnings };
}

const fields = (extra = {}) => ({
  title: "一篇真实的文章", content: "# 一篇真实的文章\n\n正文与**思考**。\n", date: "2026-10-28",
  type: "note", tags: ["学习"], excerpt: "", pinned: false, status: "draft", ...extra,
});
const fails = (status) => (error) => error.status === status;

test("legacy articles remain readable and API dates sort chronologically without zero-padding", async (t) => {
  const { store, docsDir } = await fixture(t);
  await fs.writeFile(path.join(docsDir, "旧笔记.md"), "# 旧笔记\n\n不捏造日期。\n");
  await fs.writeFile(path.join(docsDir, "2026-9-10.md"), "# 九月记录\n\n九月正文\n");
  await fs.writeFile(path.join(docsDir, "2026-10-1.md"), "# 十月记录\n\n十月正文\n");
  const posts = await store.listPublic();
  assert.deepEqual(posts.map((p) => p.slug), ["2026-10-1", "2026-9-10", "旧笔记"]);
  assert.equal(posts[0].date, "2026-10-01");
  assert.equal(posts[2].date, "旧笔记");
  assert.equal(posts[2].type, "uncategorized");
  assert.equal("content" in posts[0], false);
  const old = await store.getAdmin("旧笔记");
  assert.equal(old.status, "published");
  assert.equal(old.date, "");
  assert.ok(old.content.includes("不捏造日期"));
});

test("draft creation is private, supports Unicode slugs, and rejects duplicate names across states", async (t) => {
  const { store, docsDir, draftsDir } = await fixture(t);
  const created = await store.create(fields({ slug: "新的一页", tags: ["学习", "学习", "随笔"] }));
  assert.equal(created.status, "draft");
  assert.match(created.version, /^[a-f0-9]{64}$/);
  assert.deepEqual(created.tags, ["学习", "随笔"]);
  assert.equal(created.customExcerpt, "");
  assert.ok(created.excerpt.includes("正文"));
  assert.deepEqual(await store.listPublic(), []);
  await assert.rejects(store.getPublic(created.slug), fails(404));
  assert.deepEqual(await fs.readdir(docsDir), []);
  assert.deepEqual(await fs.readdir(draftsDir), ["新的一页.md"]);
  const summary = (await store.listAdmin("draft"))[0];
  assert.equal("content" in summary, false);
  assert.equal(summary.version, created.version);
  await assert.rejects(store.create(fields({ slug: created.slug, status: "published" })), fails(409));
  await assert.rejects(store.listAdmin("secret"), fails(400));
});

test("publish, edit, withdraw, and delete use version preconditions and never expose drafts", async (t) => {
  const { store, docsDir, draftsDir } = await fixture(t);
  const draft = await store.create(fields({ slug: "完整流程" }));
  await assert.rejects(store.update(draft.slug, fields()), fails(428));
  const published = await store.update(draft.slug, fields({ status: "published", version: draft.version, excerpt: "自定摘要" }));
  assert.equal(published.customExcerpt, "自定摘要");
  assert.equal((await store.getPublic(draft.slug)).excerpt, "自定摘要");
  assert.equal((await store.listPublic()).length, 1);
  assert.deepEqual(await fs.readdir(draftsDir), []);
  await assert.rejects(store.update(draft.slug, fields({ version: draft.version })), fails(409));
  const changed = await store.update(draft.slug, fields({ status: "published", content: "修改后的正文\n", version: published.version }));
  assert.equal((await store.getPublic(draft.slug)).content, "修改后的正文\n");
  const withdrawn = await store.update(draft.slug, fields({ content: changed.content, status: "draft", version: changed.version }));
  assert.equal(withdrawn.status, "draft");
  await assert.rejects(store.getPublic(draft.slug), fails(404));
  assert.deepEqual(await fs.readdir(docsDir), []);
  await assert.rejects(store.delete(draft.slug), fails(428));
  await assert.rejects(store.delete(draft.slug, changed.version), fails(409));
  await store.delete(draft.slug, withdrawn.version);
  await assert.rejects(store.getAdmin(draft.slug), fails(404));
  assert.deepEqual(await fs.readdir(draftsDir), []);
});

test("concurrent saves cannot silently overwrite one another or a manual file edit", async (t) => {
  const { store, docsDir } = await fixture(t);
  const article = await store.create(fields({ status: "published" }));
  const saves = await Promise.allSettled([
    store.update(article.slug, fields({ status: "published", content: "first", version: article.version })),
    store.update(article.slug, fields({ status: "published", content: "second", version: article.version })),
  ]);
  assert.equal(saves.filter((save) => save.status === "fulfilled").length, 1);
  assert.equal(saves.find((save) => save.status === "rejected").reason.status, 409);
  const latest = await store.getAdmin(article.slug);
  await fs.appendFile(path.join(docsDir, `${article.slug}.md`), "\n手工修改\n");
  await assert.rejects(store.update(article.slug, fields({ version: latest.version })), fails(409));
});

test("a file appearing during publication is never overwritten and the source is preserved", async (t) => {
  const { store, docsDir, draftsDir } = await fixture(t);
  const original = await store.create(fields({ slug: "外部冲突" }));
  const source = path.join(draftsDir, "外部冲突.md");
  const target = path.join(docsDir, "外部冲突.md");
  const originalLink = fs.link;
  let injected = false;
  fs.link = async (from, to) => {
    if (from === source && to === target && !injected) {
      injected = true;
      await fs.writeFile(target, "# 外部创建的文章\n\n不要覆盖\n", { flag: "wx" });
    }
    return originalLink(from, to);
  };
  try {
    await assert.rejects(store.update(original.slug, fields({ status: "published", version: original.version })), fails(409));
    assert.equal(await fs.readFile(target, "utf8"), "# 外部创建的文章\n\n不要覆盖\n");
    assert.equal(matter(await fs.readFile(source, "utf8")).data.status, "draft");
  } finally {
    fs.link = originalLink;
  }
});

test("a failed withdrawal transfer remains hidden and can be recovered from the admin detail", async (t) => {
  const { store, docsDir } = await fixture(t);
  const published = await store.create(fields({ slug: "撤回故障", status: "published" }));
  const source = path.join(docsDir, "撤回故障.md");
  const originalUnlink = fs.unlink;
  let injected = false;
  fs.unlink = async (file) => {
    if (file === source && !injected) {
      injected = true;
      const error = new Error("simulated removal failure");
      error.code = "EACCES";
      throw error;
    }
    return originalUnlink(file);
  };
  try {
    await assert.rejects(store.update(published.slug, fields({ status: "draft", version: published.version })), fails(503));
    await assert.rejects(store.getPublic(published.slug), fails(404));
    const recovered = await store.getAdmin(published.slug);
    assert.equal(recovered.status, "draft");
    assert.ok(recovered.content.includes("正文"));
    assert.notEqual(recovered.version, published.version);
    const saved = await store.update(recovered.slug, fields({ version: recovered.version }));
    assert.equal(saved.status, "draft");
    assert.equal((await store.listPublic()).length, 0);
  } finally {
    fs.unlink = originalUnlink;
  }
});

test("metadata is safely serialized, unknown front matter is preserved, and deliberate blank dates stay blank", async (t) => {
  const { store, docsDir } = await fixture(t);
  const raw = "---\ntitle: 老标题\ncustomField: 保留我\n---\n# 2026-10-28 这是正文日期\n\n原正文\n";
  await fs.writeFile(path.join(docsDir, "2026-10-28.md"), raw);
  const old = await store.getAdmin("2026-10-28");
  const content = "---javascript\n(() => { throw new Error('must not execute') })()\n---\n# Markdown 正文\n";
  const saved = await store.update(old.slug, fields({ title: "标题: 含 YAML 符号", date: "", status: "published", content, version: old.version }));
  assert.equal(saved.content, content);
  assert.equal(saved.date, "");
  assert.equal((await store.getPublic(old.slug)).date, "");
  const disk = matter(await fs.readFile(path.join(docsDir, `${old.slug}.md`), "utf8"));
  assert.equal(disk.data.customField, "保留我");
  assert.equal(disk.data.title, "标题: 含 YAML 符号");
  assert.equal(disk.content, content);
  const emptyDraft = await store.create(fields({ title: "空草稿", content: "" }));
  assert.equal(emptyDraft.content, "\n");
});

test("malformed/unsafe metadata and directories do not poison the public list; explicit drafts fail closed", async (t) => {
  const { store, docsDir, warnings } = await fixture(t);
  await store.create(fields({ slug: "好文章", status: "published" }));
  await fs.mkdir(path.join(docsDir, "目录.md"));
  await fs.writeFile(path.join(docsDir, "坏文章.md"), "---\ntags: [broken\n---\n正文");
  await fs.writeFile(path.join(docsDir, "危险引擎.md"), "---javascript\n(() => { throw new Error('must not execute') })()\n---\n正文");
  await fs.writeFile(path.join(docsDir, "手动草稿.md"), "---\nstatus: draft\n---\n草稿不能公开");
  assert.deepEqual((await store.listPublic()).map((p) => p.slug), ["好文章"]);
  assert.equal(warnings.length, 2);
  await assert.rejects(store.getPublic("手动草稿"), fails(404));
  await assert.rejects(store.getPublic("危险引擎"), fails(422));
  assert.equal((await store.getAdmin("手动草稿")).status, "draft");
  for (const [index, status] of ["private", "Draft", false, null, 42].entries()) {
    const slug = `坏状态${index}`;
    await fs.writeFile(path.join(docsDir, `${slug}.md`), matter.stringify({ content: "不能因拼错状态而公开", data: {} }, { status }));
    await assert.rejects(store.getPublic(slug), fails(422));
  }
  assert.deepEqual((await store.listPublic()).map((p) => p.slug), ["好文章"]);
});

test("portable filenames and strict write schemas prevent traversal and invalid data", () => {
  for (const slug of ["..", "a..b", "../app", "a/b", "a\\b", "C:foo", ".hidden", "con", "NUL.txt", "hello.", "hello ", "article.md", "a\0b", "a?b", "a".repeat(121)]) {
    assert.throws(() => validateSlug(slug), fails(400), slug);
  }
  for (const slug of ["微机原理", "2026-10-28", "linux内核", "my_note", "my.note"]) assert.equal(validateSlug(slug), slug);
  for (const input of [null, [], fields({ title: " " }), fields({ date: "2026-02-29" }), fields({ date: "2026-1-2" }),
    fields({ tags: [1] }), fields({ tags: ["x".repeat(41)] }), fields({ status: "private" }), fields({ type: "unknown" }),
    fields({ pinned: "true" }), fields({ content: "x".repeat(512 * 1024 + 1) }), fields({ status: "published", content: " " })]) {
    assert.throws(() => validatePost(input), fails(400));
  }
});
