import { useEffect } from "react";
import { Link, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import "./App.css";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Manage from "./pages/Manage";
import Editor from "./pages/Editor";
import Nav from "./components/Nav";
import Post from "./pages/Post";
import AuthProvider from "./components/AuthProvider";
import RequireAuth from "./components/RequireAuth";
import Icon from "./components/Icon";
import { useAppearance } from "./hooks/useAppearance";
import { useAuth } from "./hooks/useAuth";
import { loginPath } from "./lib/auth";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [pathname]);
  return null;
}

function NotFound() {
  return <main className="shell missing-page" id="main-content" tabIndex="-1"><title>这一页不在这里 · 栖间</title><div className="empty-state"><Icon name="leaf" /><p className="eyebrow">A SMALL DETOUR</p><h1>好像走到了一条小岔路。</h1><p>这一页不存在，回去翻翻写下的日子吧。</p><Link className="primary-button" to="/">回到首页<Icon name="arrow" /></Link></div></main>;
}

function Site() {
  const appearance = useAppearance();
  const { user } = useAuth();
  const navigate = useNavigate();
  const homeProps = { appearance, onCompose: () => navigate(user ? "/write" : loginPath("/write")) };

  return (
    <div className="app-layout">
      <ScrollToTop />
      <Nav appearance={appearance} />
      <Routes>
        <Route path="/" element={<Home {...homeProps} />} />
        <Route path="/notes" element={<Home {...homeProps} category="note" />} />
        <Route path="/logs" element={<Home {...homeProps} category="log" />} />
        <Route path="/plans" element={<Home {...homeProps} category="plan" />} />
        <Route path="/posts/:slug" element={<Post />} />
        <Route path="/login" element={<Login />} />
        <Route path="/manage" element={<RequireAuth><Manage /></RequireAuth>} />
        <Route path="/write" element={<RequireAuth preserveOnExpiry><Editor /></RequireAuth>} />
        <Route path="/manage/posts/:slug/edit" element={<RequireAuth preserveOnExpiry><Editor /></RequireAuth>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <footer className="site-footer shell"><div><Icon /><span>栖间 · 给日常一个安放的地方</span></div><span>© {appearance.now.getFullYear()} 南初 <span className="footer-separator">·</span> 日子很长，慢慢记录。</span></footer>
    </div>
  );
}

export default function App() {
  return <AuthProvider><Site /></AuthProvider>;
}
