import { dateKey, parsePostDate, POST_TYPES } from "./posts.js";

export const MAX_CONTENT_BYTES = 512 * 1024;

export function emptyPostForm() {
  return { slug: "", title: "", content: "", date: dateKey(new Date()), type: "uncategorized", tagsText: "", customExcerpt: "", pinned: false };
}

export function postToForm(post) {
  return {
    slug: post.slug,
    title: post.title,
    content: post.content,
    date: post.date || "",
    type: Object.hasOwn(POST_TYPES, post.type) ? post.type : "uncategorized",
    tagsText: (post.tags || []).join(", "),
    // Never fall back to the generated `excerpt`: blank means keep automatic excerpts automatic.
    customExcerpt: typeof post.customExcerpt === "string" ? post.customExcerpt : "",
    pinned: Boolean(post.pinned),
  };
}

export function formTags(value) {
  return [...new Set(value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean))];
}

export function contentBytes(content) {
  return new TextEncoder().encode(content).length;
}

export function validatePostForm(form) {
  if (!form.title.trim() || form.title.trim().length > 200) return "标题需要 1–200 个字符。";
  if (contentBytes(form.content) > MAX_CONTENT_BYTES) return "Markdown 正文不能超过 512 KiB（按 UTF-8 字节计算）。";
  if (form.date && (!/^\d{4}-\d{2}-\d{2}$/.test(form.date) || !parsePostDate(form.date))) return "请输入有效日期（YYYY-MM-DD），也可以留空。";
  const tags = formTags(form.tagsText);
  if (tags.length > 20) return "标签最多 20 个，请减少后再保存。";
  if (tags.some((tag) => tag.length > 40)) return "每个标签最多 40 个字符。";
  if (form.customExcerpt.length > 500) return "手写摘要最多 500 个字符。";
  if (!Object.hasOwn(POST_TYPES, form.type)) return "请选择有效的文章分类。";
  return null;
}

export function postPayload(form, status, isNew) {
  return {
    ...(isNew && form.slug.trim() ? { slug: form.slug.trim() } : {}),
    title: form.title.trim(),
    content: form.content,
    date: form.date,
    type: form.type,
    tags: formTags(form.tagsText),
    excerpt: form.customExcerpt,
    pinned: form.pinned,
    status,
  };
}

export function formatUpdatedAt(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "更新时间未知" : date.toLocaleString("zh-CN", { hour12: false });
}
