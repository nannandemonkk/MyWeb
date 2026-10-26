// src/hooks/usePost.js —— 管理单篇文章数据的生命周期
// 和 usePosts 是双胞胎套路：请求 → loading/error/data 三状态

import { useEffect, useState } from "react";
import { fetchPost } from "../api";

export function usePost(slug) {
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPost(slug)
      .then(setPost)                          // 成功：存下文章
      .catch((err) => setError(err.message))   // 失败：存下错误
      .finally(() => setLoading(false));       // 不论成败：结束加载
  }, [slug]);                                  // 依赖 slug：slug 变了就重新执行

  return { post, loading, error };
}
