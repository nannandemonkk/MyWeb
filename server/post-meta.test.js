import test from "node:test";
import assert from "node:assert/strict";
import matter from "gray-matter";
import { parseMeta } from "./post-meta.js";
import { articleBody, dateKey, formatPostDate, matchesSearch, parsePostDate, postType } from "../src/lib/posts.js";
import { timeScene } from "../src/lib/appearance.js";

// These tests do not modify or publish any of the author's documents.
test("legacy documents retain their title and date without invented categories", () => {
  const meta = parseMeta("2026-09-17", matter("# 9月17日\n\n今天学习了一点新东西。"));
  assert.equal(meta.title, "9月17日");
  assert.equal(meta.date, "2026-09-17");
  assert.equal(meta.type, "uncategorized");
  assert.deepEqual(meta.tags, []);
  assert.equal(meta.excerpt, "今天学习了一点新东西。");
});

test("legacy heading-only paragraphs remain in excerpts and search", () => {
  const meta = parseMeta("2026-09-17", matter("# 9月17日\n## 上午\n### 学习了多租户与数据库\n## 下午\n### 整理笔记"));
  assert.equal(meta.excerpt.includes("学习了多租户与数据库"), true);
  assert.equal(matchesSearch(meta, "多租户"), true);
  assert.equal(meta.excerpt.includes("#"), false);
});

test("a date in a progress paragraph is not a publication date", () => {
  const meta = parseMeta("微机原理", matter("# 微机原理学习笔记\n\n- 2026-10-25：学习进度。"));
  assert.equal(meta.date, "微机原理");
  assert.equal(parsePostDate(meta.date), null);
  assert.equal(formatPostDate(meta.date), "日期未标注");
});

test("explicit metadata is validated and optional", () => {
  const meta = parseMeta("entry", { data: { title: " 标题 ", date: new Date("2026-10-26T00:00:00Z"), type: "diary", tags: ["生活", "生活", 42, " "], pinned: true, excerpt: " 自己写的摘要 " }, content: "# 正文\n内容" });
  assert.equal(meta.title, "标题");
  assert.equal(meta.date, "2026-10-26");
  assert.equal(meta.type, "log");
  assert.deepEqual(meta.tags, ["生活"]);
  assert.equal(meta.pinned, true);
  assert.equal(meta.excerpt, "自己写的摘要");
  for (const type of [null, "unknown", "__proto__", ["note"], {}]) {
    assert.equal(parseMeta("entry", { data: { type }, content: "" }).type, "uncategorized");
  }
  assert.equal(postType({ type: "__proto__" }), "uncategorized");
});

test("excerpts are derived from real text without code fences or image markup", () => {
  const content = "# 标题\n\n真实的**记录**和[链接](https://example.org)。\n\n```js\nsecretExample()\n```\n![图](test.png)";
  const meta = parseMeta("entry", matter(content));
  assert.equal(meta.excerpt, "真实的记录和链接。");
  assert.equal(content.includes("secretExample"), true);
  assert.ok(meta.readingMinutes >= 1);
});

test("calendar accepts real local dates and rejects rollover or unknown dates", () => {
  assert.equal(dateKey(parsePostDate("2028-02-29")), "2028-02-29");
  assert.equal(dateKey(parsePostDate("2026.9.17")), "2026-09-17");
  for (const value of ["2026-02-29", "2026-04-31", "2026-13-01", "2026-00-10", "2026-01-00", "UML", "", null]) {
    assert.equal(parsePostDate(value), null);
  }
});

test("search matches titles, actual excerpts and tags with all query words", () => {
  const post = { title: "Linux 内核", excerpt: "进程与内存管理", tags: ["学习笔记"] };
  assert.equal(matchesSearch(post, "LINUX 内存"), true);
  assert.equal(matchesSearch(post, "学习笔记"), true);
  assert.equal(matchesSearch(post, "Linux 不存在"), false);
  assert.equal(matchesSearch(post, " "), true);
});

test("reading page removes only one matching opening H1", () => {
  const body = articleBody({ title: "微机原理学习笔记", content: "# 微机原理学习笔记\n\n## 进度\n\n# 第一章\n内容\n# 第二章\n内容" });
  assert.equal(body.startsWith("# 微机原理学习笔记"), false);
  assert.equal(body.includes("# 第一章"), true);
  assert.equal(body.includes("# 第二章"), true);
  assert.equal(articleBody({ title: "linux内核", content: "学习 Linux 内核\n正文" }), "学习 Linux 内核\n正文");
  assert.equal(articleBody({ title: "元数据标题", content: "# 不同的正文标题\n正文" }), "# 不同的正文标题\n正文");
});

test("explicit blank dates remain undated and written timezone dates do not shift a calendar day", () => {
  assert.equal(parseMeta("2026-10-28", matter("---\ndate: ''\n---\n# 2026-10-28 正文日期\n内容")).date, "");
  const timestamp = matter("---\ndate: 2026-10-26T00:30:00+08:00\n---\n# 标题\n内容");
  assert.equal(parseMeta("entry", timestamp).date, "2026-10-26");
  assert.equal(parseMeta("entry", matter("---\ndate: '2026.9.7'\n---\n内容")).date, "2026-09-07");
  assert.equal(parseMeta("entry", matter("# 标题尾部空格   \n内容")).title, "标题尾部空格");
});

test("automatic atmosphere has explicit time boundaries", () => {
  for (const [hour, scene] of [[0, "night"], [5, "morning"], [10, "morning"], [11, "afternoon"], [16, "afternoon"], [17, "evening"], [19, "evening"], [20, "night"]]) {
    assert.equal(timeScene(new Date(2026, 9, 26, hour)), scene);
  }
});
