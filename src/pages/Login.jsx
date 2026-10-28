import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { safeReturnPath } from "../lib/auth";
import Icon from "../components/Icon";

export default function Login() {
  const auth = useAuth();
  const [params] = useSearchParams();
  const returnTo = safeReturnPath(params.get("next"));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);

  if (auth.user && !busy) return <Navigate replace to={returnTo} />;

  async function submit(event) {
    event.preventDefault();
    if (busy || auth.loading || auth.configured !== true) return;
    setBusy(true);
    setError(null);
    try {
      await auth.login(username.trim(), password);
      setPassword("");
    } catch (failure) {
      setError(failure);
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  async function checkSession() {
    if (checking) return;
    setChecking(true);
    setError(null);
    try { await auth.refreshSession(); }
    catch (failure) { setError(failure); }
    finally { setChecking(false); }
  }

  const failure = error || auth.error;
  return (
    <main className="shell auth-page" id="main-content" tabIndex="-1">
      <title>管理员登录 · 栖间</title>
      <Link className="back-link" to="/"><Icon name="back" />回到公开记录</Link>
      <section className="auth-card" aria-labelledby="login-title">
        <div className="auth-mark"><Icon name="leaf" /></div>
        <p className="eyebrow">A PLACE FOR YOUR WORDS</p>
        <h1 id="login-title">回到你的写作空间。</h1>
        <p className="auth-intro">这里是南初的私人书桌。阅读无需登录，写作仅向本站管理员开放。</p>
        {auth.loading ? <p className="inline-notice" role="status">正在检查服务器与登录状态…</p> :
          auth.configured === false ? <div className="inline-notice setup-notice" role="status"><strong>管理员尚未初始化</strong><p>请在服务器上执行 <code>npm run admin:setup</code> 完成管理员设置并重启后端，再回来登录。</p><p>本站不提供网页初始化、注册或默认密码。</p><button type="button" className="text-button" disabled={checking} onClick={checkSession}>{checking ? "正在检查…" : "已完成设置，重新检查"}<Icon name="arrow" /></button></div> :
            auth.configured === true ? <form className="auth-form" onSubmit={submit} aria-busy={busy}>
              <label className="field"><span>管理员用户名</span><input name="username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" autoCapitalize="none" spellCheck="false" required disabled={busy} /></label>
              <label className="field"><span>密码</span><input name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required disabled={busy} /></label>
              <button className="primary-button auth-submit" type="submit" disabled={busy || !username.trim() || !password}>{busy ? "正在确认登录…" : "登录，继续写下去"}<Icon name="arrow" /></button>
            </form> : <button type="button" className="secondary-button" disabled={checking} onClick={checkSession}>{checking ? "正在检查…" : "重新检查会话"}</button>}
        {failure && <div className="inline-notice error-notice" role="alert"><strong>暂时没能登录</strong><p>{failure.message}</p>{failure.status > 0 && <small>HTTP {failure.status}</small>}</div>}
        <p className="auth-footnote">登录使用本站安全会话 Cookie，不在浏览器保存密码。没有账号注册入口。</p>
      </section>
    </main>
  );
}
