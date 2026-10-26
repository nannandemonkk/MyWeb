// src/api.js —— 数据层：负责跟后端打交道
// 组件只管画界面，要数据就调这里，不关心数据是怎么来的

const BASE = "/api";

// 文章列表
export async function fetchPosts() {
  const res = await fetch(`${BASE}/posts`);
  if (!res.ok) throw new Error("获取文章列表失败");
  return res.json();
}

// 单篇文章详情
export async function fetchPost(slug) {
  const res = await fetch(`${BASE}/posts/${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error("文章不存在");
  return res.json();
}
