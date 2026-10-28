import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { fetchPosts } from "../api";

export function usePosts() {
  const { key } = useLocation();
  const [revision, setRevision] = useState(0);
  const requestKey = `${key}:${revision}`;
  const [result, setResult] = useState({ key: null, posts: [], error: null });

  useEffect(() => {
    const reload = () => setRevision((value) => value + 1);
    const onVisibility = () => { if (document.visibilityState === "visible") reload(); };
    window.addEventListener("myweb:posts-changed", reload);
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("myweb:posts-changed", reload);
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchPosts({ signal: controller.signal })
      .then((posts) => { if (!controller.signal.aborted) setResult({ key: requestKey, posts, error: null }); })
      .catch((error) => { if (!controller.signal.aborted) setResult({ key: requestKey, posts: [], error }); });
    return () => controller.abort();
  }, [requestKey]);

  const loading = result.key !== requestKey;
  return { posts: result.posts, loading, error: loading ? null : result.error?.message, errorStatus: result.error?.status, reload: () => setRevision((value) => value + 1) };
}
