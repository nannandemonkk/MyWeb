import { Outlet } from "react-router-dom";
import { Link } from "react-router-dom";


export default function Home() {
  return (
    <main className="container content">
      <div className="post">
        <Outlet />
        <h2>Welcome to my blog</h2>
        <p>
          This is my personal blog where I write about programming, learning,
          and computer science.
        </p>

        <h3>Recent Posts</h3>
        <ul className="post-list">
          <li>
            <span>2026-05-13</span>
            <Link to="/react-learning">React Router 学习笔记</Link>
          </li>
          <li>
            <span>2026-05-29</span>
            <Link to="/may-29">5月29日学习笔记</Link>
          </li>


        </ul>
      </div>
    </main>
  );
}
