import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { loginPath } from "../lib/auth";
import Icon from "./Icon";

export default function SessionRecovery() {
  const auth = useAuth();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");
  if (auth.user) return null;

  async function check() {
    setChecking(true);
    setMessage("");
    try {
      const session = await auth.refreshSession();
      if (!session.user) setMessage("尚未检测到登录，请先在另一个标签页完成登录。");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setChecking(false);
    }
  }

  return <section className="inline-notice session-notice" aria-labelledby="session-recovery-title" role="alert">
    <strong id="session-recovery-title">请重新登录，文字仍留在这里。</strong>
    <p>会话已结束或失效，保存与删除已停用。请不要刷新或关闭本页；在另一标签页登录后回来检查，即可继续保存当前文字。</p>
    <div className="notice-actions"><Link className="secondary-button" to={loginPath("/manage")} target="_blank" rel="noopener noreferrer">在新标签页登录<Icon name="arrow" /></Link><button type="button" className="secondary-button" disabled={checking} onClick={check}>{checking ? "正在检查…" : "已登录，重新检查会话"}</button></div>
    {message && <p className="notice-detail">{message}</p>}
  </section>;
}
