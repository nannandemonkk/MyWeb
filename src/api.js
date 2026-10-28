const BASE = "/api";

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Keep response status and the server's error message, including 401/409/428.
export async function apiRequest(path, { method = "GET", body, csrfToken, signal, requiresCsrf = false } = {}) {
  if (requiresCsrf && !csrfToken) throw new ApiError("登录会话已失效，请重新登录后再试。", 401);
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers,
      signal,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError("无法连接服务器，请检查网络或服务状态后重试。", 0);
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(typeof data?.error === "string" && data.error.trim() ? data.error : `请求失败（HTTP ${response.status}）`, response.status);
  }
  if (data === null) throw new ApiError("服务器返回的数据格式有误，请稍后重试。", response.status);
  return data;
}

export async function fetchPosts({ signal } = {}) {
  const posts = await apiRequest("/posts", { signal });
  if (!Array.isArray(posts)) throw new ApiError("文章列表格式有误", 200);
  return posts;
}

export function fetchPost(slug, { signal } = {}) {
  return apiRequest(`/posts/${encodeURIComponent(slug)}`, { signal });
}

export function fetchSession({ signal } = {}) {
  return apiRequest("/auth/session", { signal });
}

export function loginRequest(username, password, { csrfToken } = {}) {
  // An anonymous session has no token; login establishes the HttpOnly cookie.
  return apiRequest("/auth/login", { method: "POST", body: { username, password }, csrfToken });
}

export function logoutRequest(csrfToken) {
  return apiRequest("/auth/logout", { method: "POST", csrfToken, requiresCsrf: true });
}

export async function fetchAdminPosts(status = "all", { signal } = {}) {
  const posts = await apiRequest(`/admin/posts?${new URLSearchParams({ status })}`, { signal });
  if (!Array.isArray(posts)) throw new ApiError("管理文章列表格式有误", 200);
  return posts;
}

export function fetchAdminPost(slug, { signal } = {}) {
  return apiRequest(`/admin/posts/${encodeURIComponent(slug)}`, { signal });
}

function notifyPostsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("myweb:posts-changed"));
}

export async function createPost(post, { csrfToken } = {}) {
  const result = await apiRequest("/admin/posts", { method: "POST", body: post, csrfToken, requiresCsrf: true });
  notifyPostsChanged();
  return result;
}

export async function updatePost(slug, post, { csrfToken } = {}) {
  const result = await apiRequest(`/admin/posts/${encodeURIComponent(slug)}`, { method: "PUT", body: post, csrfToken, requiresCsrf: true });
  notifyPostsChanged();
  return result;
}

export async function deletePost(slug, version, { csrfToken } = {}) {
  await apiRequest(`/admin/posts/${encodeURIComponent(slug)}`, { method: "DELETE", body: { version }, csrfToken, requiresCsrf: true });
  notifyPostsChanged();
}
