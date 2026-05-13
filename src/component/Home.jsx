export default function Home() {
  return (
    <main className="container content">
      <div className="post">
        <h2>Welcome to my blog</h2>
        <p>
          This is my personal blog where I write about programming, learning,
          and computer science.
        </p>

        <h3>Recent Posts</h3>
        <ul className="post-list">
          <li>
            <span>2025-01-01</span>
            <a href="/post/1">React Router 学习笔记</a>
          </li>
          <li>
            <span>2025-01-02</span>
            <a href="/post/2">Markdown 使用教程</a>
          </li>
        </ul>
      </div>
    </main>
  );
}
