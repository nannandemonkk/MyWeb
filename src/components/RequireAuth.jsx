import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { loginPath } from "../lib/auth";
import Icon from "./Icon";

export default function RequireAuth({ children, preserveOnExpiry = false }) {
  const { user, loading, configured, error, refreshSession } = useAuth();
  const location = useLocation();
  const [entered, setEntered] = useState(false);
  const [retrying, setRetrying] = useState(false);
  // Once opened, an editor must remain mounted even if its session expires.
  if (user && !entered) setEntered(true);
  if (preserveOnExpiry && entered) return children;
  if (loading) return <main className="shell access-page" id="main-content" tabIndex="-1"><title>正在检查会话 · 栖间</title><div className="reading-status" role="status"><Icon name="leaf" /><h1>正在确认你的会话…</h1><p>公开记录无需登录，写作空间仅向管理员开放。</p></div></main>;
  if (!user && error && configured === null) {
    async function retry() {
      setRetrying(true);
      try { await refreshSession(); } catch { /* The provider keeps the actual error. */ }
      finally { setRetrying(false); }
    }
    return <main className="shell access-page" id="main-content" tabIndex="-1"><title>会话暂不可用 · 栖间</title><div className="reading-status" role="alert"><Icon name="info" /><h1>暂时无法确认登录状态</h1><p>{error.message}</p><button className="secondary-button" disabled={retrying} onClick={retry}>{retrying ? "正在重试…" : "重新检查"}</button></div></main>;
  }
  if (!user) return <Navigate replace to={loginPath(`${location.pathname}${location.search}${location.hash}`)} />;
  return children;
}
