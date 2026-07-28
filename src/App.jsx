import "./App.css";
import { Route, Routes } from "react-router-dom";
import Home from "./component/Home";
import Nav from "./component/Nav";
import Post from "./component/Post";
import posts from "./component/posts";

function App() {
  return (
    <div className="page">
      
      {/* 导航栏 */}
      <Nav />

      {/* 内容区域 */}
      <Routes>
        <Route path="/" element={<Home posts={posts} />} />
        {posts.map((post) => (
          <Route
            key={post.slug}
            path={`/post/${post.slug}`}
            element={<Post mdContent={post.content} />}
          />
        ))}
      </Routes>

      {/* 底部 */}
      <footer className="site-footer">
        <div className="container">© 2026 My Blog</div>
      </footer>
    </div>
  );
}

export default App;
