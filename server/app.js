// server/app.js —— 博客后端
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";

const app = express();
// 端口优先读环境变量 PORT —— 部署到云端时，平台会用自己的方式告诉你该监听哪个端口
// 没有这个变量就用 3000（本地开发）
const PORT = process.env.PORT || 3000;

// document 目录在哪里
// import.meta.dirname 是「这个文件所在的目录」，也就是 .../MyWeb/server
// 文章数据现在跟后端放在一起，所以直接接 document 就行
const DOCS_DIR = path.join(import.meta.dirname, "document");

// 从 md 正文里抠出标题和日期（跟原前端 posts.js 里那套一样）
function parseMeta(filename, content) {
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : filename;
  const dateMatch = content.match(/^#\s+(\d{4}[-.]\d{1,2}[-.]\d{1,2})/m);
  const date = dateMatch ? dateMatch[1] : filename;
  return { title, date };
}

// ---------- 接口一：文章列表 ----------
app.get("/api/posts", async (req, res) => {
  // 1. 读出 document 目录下所有文件名
  const files = await fs.readdir(DOCS_DIR);

  // 2. 只要 .md，别的（图片之类）跳过
  const mdFiles = files.filter((f) => f.endsWith(".md"));

  // 3. 挨个读内容，拼出列表
  const posts = [];
  for (const file of mdFiles) {
    const content = await fs.readFile(path.join(DOCS_DIR, file), "utf-8");
    const slug = file.replace(/\.md$/, ""); // 文件名去掉 .md 就是 slug
    const { title, date } = parseMeta(slug, content);
    posts.push({ slug, title, date }); // 注意：不带 content
  }

  // 4. 按日期倒序，新的在前
  posts.sort((a, b) => {
    const aNum = parseInt(a.date.replace(/\D/g, ""), 10) || 0;
    const bNum = parseInt(b.date.replace(/\D/g, ""), 10) || 0;
    return bNum - aNum;
  });

  // 5. 回 JSON
  res.json(posts);
});

// ---------- 接口二：单篇文章详情 ----------
app.get("/api/posts/:slug", async (req, res) => {
  const { slug } = req.params; // :slug 这一段从 URL 里取

  // 别让 slug 里塞 ../ 跑到 document 目录外面去
  if (slug.includes("..") || slug.includes("/") || slug.includes("\\")) {
    return res.status(400).json({ error: "非法的 slug" });
  }

  try {
    const content = await fs.readFile(path.join(DOCS_DIR, slug + ".md"), "utf-8");
    const { title, date } = parseMeta(slug, content);
    res.json({ slug, title, date, content });
  } catch {
    res.status(404).json({ error: "文章不存在" });
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`后端起来了: http://localhost:${PORT}`);
});
