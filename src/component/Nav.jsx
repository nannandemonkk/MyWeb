import { Link } from "react-router-dom";

export default function Nav() {
  return (
    <header className="site-header">
      <div className="container nav-row">
        <h1 className="site-title">blog</h1>
        {/* <nav className="site-nav">
          <Link to="/">首页</Link>
        </nav> */}
        <img src="./../image/avater.jpg" alt="头像" className="avatar" />
      </div>
    </header>
  );
}