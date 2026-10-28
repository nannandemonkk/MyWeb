import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { fetchPost } from "../api";

export function usePost(slug) {
  const { key } = useLocation();
  const [revision, setRevision] = useState(0);
  const requestKey = `${slug}:${key}:${revision}`;
  const [result, setResult] = useState({ key: null, post: null, error: null });

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
    fetchPost(slug, { signal: controller.signal })
      .then((post) => { if (!controller.signal.aborted) setResult({ key: requestKey, post, error: null }); })
      .catch((error) => { if (!controller.signal.aborted) setResult({ key: requestKey, post: null, error }); });
    return () => controller.abort();
  }, [requestKey, slug]);

  return { post: result.post, loading: result.key !== requestKey, error: result.key === requestKey ? result.error?.message : null, errorStatus: result.error?.status };
}
