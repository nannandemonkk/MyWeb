import { articleBody, dateKey, parsePostDate } from "../src/lib/posts.js";

function publicationDate(filename, parsed) {
  const data = parsed.data || {};
  if (Object.hasOwn(data, "date")) {
    // An intentional blank is different from a legacy document with no date field.
    if (typeof data.date === "string") {
      const value = data.date.trim();
      const date = parsePostDate(value);
      return date ? dateKey(date) : value;
    }
    if (data.date instanceof Date && !Number.isNaN(data.date.valueOf())) {
      // YAML timestamps become UTC Date objects. Preserve their written calendar date where available.
      const written = parsed.matter?.match(/^date:[ \t]*["']?(\d{4}-\d{2}-\d{2})(?:[Tt ][^\r\n]*|["']?[ \t]*(?:#.*)?)$/m)?.[1];
      return written && parsePostDate(written) ? written : data.date.toISOString().slice(0, 10);
    }
  }
  const value = parsed.content?.match(/^#[ \t]+(\d{4}[-.]\d{1,2}[-.]\d{1,2})/m)?.[1] || filename;
  const date = parsePostDate(value);
  return date ? dateKey(date) : value;
}

// Legacy documents keep their title/date fallbacks; new presentation metadata is optional.
export function parseMeta(filename, parsed) {
  const data = parsed.data || {};
  const content = parsed.content || "";
  const title =
    (typeof data.title === "string" && data.title.trim()) ||
    content.match(/^#[ \t]+(.+)$/m)?.[1]?.trim() ||
    filename;
  const date = publicationDate(filename, parsed);
  const types = { note: "note", log: "log", diary: "log", plan: "plan" };
  const type = typeof data.type === "string" && Object.hasOwn(types, data.type) ? types[data.type] : "uncategorized";
  const rawTags = Array.isArray(data.tags)
    ? data.tags
    : typeof data.tags === "string" ? data.tags.split(/[,，]/) : [];
  const tags = [...new Set(rawTags.filter((tag) => typeof tag === "string")
    .map((tag) => tag.trim()).filter(Boolean))].slice(0, 20);
  const body = articleBody({ title, content });
  const plainText = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}[ \t]+/gm, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[*_`~>|]/g, "")
    .replace(/^\s*[-+]\s+/gm, "")
    .replace(/\s+/g, " ").trim();
  const excerpt = (typeof data.excerpt === "string" && data.excerpt.trim()) || plainText;

  return {
    title,
    date,
    type,
    tags,
    excerpt: excerpt.length > 140 ? `${excerpt.slice(0, 140)}…` : excerpt,
    readingMinutes: Math.max(1, Math.ceil(content.replace(/\s/g, "").length / 500)),
    pinned: data.pinned === true,
  };
}
