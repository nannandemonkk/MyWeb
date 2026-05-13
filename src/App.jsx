import "./App.css";

function App() {
  return (
    <div className="page">
      {/* 顶部黑色导航 */}
      <header className="site-header">
        <div className="container">
          <h1 className="site-title">My Blog</h1>
          <nav className="site-nav">
            <a href="/">Home</a>
            <a href="/posts">Posts</a>
            <a href="/about">About</a>
          </nav>
        </div>
      </header>

      {/* 内容区域 */}
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

          <h3>Code Example</h3>
          <pre>
            <code>
              {`function App() {
  return (
    <div>Hello World</div>
  )
}`}
            </code>
          </pre>
        </div>
      </main>

      {/* 底部 */}
      <footer className="site-footer">
        <div className="container">© 2025 My Blog</div>
      </footer>
    </div>
  );
}

export default App;
