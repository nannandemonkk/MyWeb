import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { loginPath } from "../lib/auth";
import Dialog from "./Dialog";
import Icon from "./Icon";
import ScenePicker from "./ScenePicker";

export default function Nav({ appearance }) {
  const auth = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [signingOut, setSigningOut] = useState(false);
  const [notice, setNotice] = useState(null);
  const menuRef = useRef(null);
  const avatarRef = useRef(null);
  const searchRef = useRef(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const query = params.get("q") || "";

  useEffect(() => {
    function onPointerDown(event) {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === "Escape") {
        if (menuRef.current?.contains(event.target)) {
          event.preventDefault();
          avatarRef.current?.focus();
        }
        setMenuOpen(false);
      }
      if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey &&
          !event.target.closest("input, textarea, select, [contenteditable='true']") && !document.querySelector("dialog[open]")) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  function search(event) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("q").trim();
    navigate(value ? `/?${new URLSearchParams({ q: value })}` : "/");
    searchRef.current.blur();
  }

  function openDialog(name) {
    setMenuOpen(false);
    setDialog(name);
  }

  function closeDialog() {
    setDialog(null);
    avatarRef.current?.focus();
  }

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setNotice(null);
    try {
      await auth.logout();
      setMenuOpen(false);
      setNotice({ text: "已退出登录。若有尚未保存的文字，仍保留在当前编辑页。", error: false });
    } catch (error) {
      setNotice({ text: `${error.message}${error.status ? `（HTTP ${error.status}）` : ""}`, error: true });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <header className="site-header">
        <div className="shell header-inner">
          <Link className="brand" to="/" aria-label="栖间，回到首页">
            <span className="brand-mark"><Icon /></span>
            <span><span className="brand-name">栖间</span><span className="brand-sub">A QUIET CORNER</span></span>
          </Link>
          <nav className="main-nav" aria-label="主导航">
            {[["/", "首页"], ["/notes", "笔记"], ["/logs", "日志"], ["/plans", "计划"]].map(([path, label]) =>
              <NavLink key={path} to={path} end className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>{label}</NavLink>)}
          </nav>
          <div className="header-actions">
            <form className="search-form" role="search" onSubmit={search}>
              <button type="submit" aria-label="搜索记录"><Icon name="search" /></button>
              <input key={query} ref={searchRef} name="q" type="search" defaultValue={query} placeholder="搜索记录…" aria-label="搜索标题、摘要或标签" autoComplete="off" />
              <kbd aria-hidden="true">/</kbd>
            </form>
            <Link className="auth-entry" to={auth.user ? "/manage" : loginPath("/manage")}>{auth.user ? "管理" : "登录"}</Link>
            <div className="avatar-wrap" ref={menuRef}>
              <button ref={avatarRef} className="avatar-trigger" aria-label="打开小站菜单" aria-expanded={menuOpen} aria-controls="site-menu" onClick={() => setMenuOpen(!menuOpen)}>
                <img src="/image/avatar.jpg" alt="" className="avatar" width="38" height="38" /><Icon name="down" />
              </button>
              {menuOpen && <div id="site-menu" className="avatar-menu">
                <div className="menu-intro"><strong>南初的记录空间</strong><span>{auth.user ? `已登录 · ${auth.user.username}` : "认真生活，自由生长"}</span></div>
                {auth.user ? <>
                  <Link to="/manage" onClick={() => setMenuOpen(false)}><Icon name="book" />管理文章</Link>
                  <Link to="/write" onClick={() => setMenuOpen(false)}><Icon name="pen" />写点什么</Link>
                  <button disabled={signingOut} onClick={signOut}><Icon name="back" />{signingOut ? "正在退出…" : "退出登录"}</button>
                </> : <Link to={loginPath("/manage")} onClick={() => setMenuOpen(false)}><Icon name="pen" />管理员登录</Link>}
                <button onClick={() => openDialog("appearance")}><Icon name="settings" />外观与氛围</button>
                <button onClick={() => openDialog("about")}><Icon name="info" />关于这个空间</button>
                <p className="menu-hint">{auth.user ? "草稿仅管理员可见，发布后公开阅读" : "公开阅读无需登录，无注册入口"}</p>
              </div>}
            </div>
          </div>
        </div>
      </header>
      {notice && <div className={`shell nav-notice${notice.error ? " error-notice" : ""}`} role={notice.error ? "alert" : "status"}><span>{notice.text}</span><button className="icon-button" onClick={() => setNotice(null)} aria-label="关闭提示"><Icon name="close" /></button></div>}
      <Dialog open={dialog === "appearance"} onClose={closeDialog} title="让小站，像你一点。" subtitle="外观偏好仅保存在当前浏览器，不会修改文章。">
        <div className="setting-section"><h3>此刻的光线</h3><ScenePicker appearance={appearance} />
          <button className="auto-scene" aria-pressed={appearance.mode === "auto"} onClick={() => appearance.setMode("auto")}><Icon name="clock" />跟随本地时间{appearance.mode === "auto" && <span>已开启</span>}</button>
        </div>
        <div className="setting-section setting-row"><div><h3 id="particles-label">漂浮光尘</h3><p>只在首页介绍区轻轻漂浮。</p></div>
          <button className="switch" role="switch" aria-checked={appearance.particles} aria-labelledby="particles-label" onClick={() => appearance.setParticles(!appearance.particles)} />
        </div>
        <p className="setting-note"><Icon name="leaf" />系统开启“减少动态效果”时，光尘会自动停用。</p>
      </Dialog>
      <Dialog open={dialog === "about"} onClose={closeDialog} title="给日常，一个安放的地方。" subtitle="栖间 · 南初的个人记录空间">
        <div className="info-copy"><p>在这里收集学习的片段、生活的感受，也给未来留下一点期待。</p><p>每个人都可以阅读、搜索和按日期浏览已发布的记录。管理员登录后，可以编写 Markdown、预览、手动保存草稿与发布文章；这里没有注册入口，也不会自动保存文字。</p><p>草稿不会出现在公开页面。原有文章尚未标注分类或标签时，会如实显示为“未分类”，不会替你猜测。计划提醒与实时天气尚未接入。</p></div>
      </Dialog>
    </>
  );
}
