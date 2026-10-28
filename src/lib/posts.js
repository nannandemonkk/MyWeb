export const POST_TYPES = {
  note: { label: "笔记", icon: "book", path: "/notes", description: "把思考留在纸上" },
  log: { label: "日志", icon: "pen", path: "/logs", description: "收集日常里的微光" },
  plan: { label: "计划", icon: "check", path: "/plans", description: "让期待慢慢发生" },
  uncategorized: { label: "未分类", icon: "leaf", path: "/", description: "一些日常，一些生长" },
};

// Only explicitly dated documents belong in the calendar. Never invent a publication date.
export function parsePostDate(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4})[-.](\d{1,2})[-.](\d{1,2})$/);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  if (y < 100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

export function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatPostDate(value) {
  const date = parsePostDate(value);
  return date ? dateKey(date).replaceAll("-", ".") : "日期未标注";
}

export function postType(post) {
  return Object.hasOwn(POST_TYPES, post.type) ? post.type : "uncategorized";
}

export function matchesSearch(post, query) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const text = [post.title, post.excerpt, ...(post.tags || [])].join(" ").toLocaleLowerCase();
  return words.every((word) => text.includes(word));
}

export function articleBody(post) {
  // Remove only the opening H1 when it exactly matches the page title; preserve all chapter headings.
  return post.content.replace(/^\s*#\s+([^\r\n]+)\r?\n?/, (match, title) =>
    title.trim() === post.title.trim() ? "" : match);
}
