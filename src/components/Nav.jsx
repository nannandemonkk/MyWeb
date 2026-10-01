import { Link } from "react-router-dom";

export default function Nav() {
  return (
    <header className="site-header">
      <div className="container nav-row">
        
        <h1 className="site-title">blog</h1>
        
        <nav className="site-nav">
          <Link to="/">首页</Link>
          <Link to="/notes">笔记</Link>
          <Link to="/logs">日志</Link>
          <Link to="/plans">计划</Link>
        </nav>
        
        <img src="/image/avatar.jpg" alt="头像" className="avatar" />
      </div>
    </header>
  );
}