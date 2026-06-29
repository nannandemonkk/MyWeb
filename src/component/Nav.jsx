export default function Nav() {
  return (
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
  );
}
