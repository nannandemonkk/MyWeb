import "./App.css";
import { Route, Routes } from "react-router-dom";
import Home from "./component/Home";
import Nav from "./component/Nav";
import Post from "./component/Post";

// 自动扫描 document 目录下的所有 md 文件
const modules = import.meta.glob("./document/*.md", { 
  query: "?raw", 
  eager: true 
});

// 将 md 模块转换为路由配置
const posts = Object.entries(modules).map(([path, content]) => {
  const fileName = path.split("/").pop().replace(".md", "");
  
  // 从 md 内容中提取标题（第一个 # 开头的行）
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : fileName;
  
  // 提取日期
  const dateMatch = content.match(/^#\s+(\d{4}[-.]\d{1,2}[-.]\d{1,2})/m) || 
                    content.match(/^#\s+(\d{1,2}月\d{1,2}日)/m) ||
                    content.match(/(\d{4}[-.]\\d{1,2}[-.]\\d{1,2})/m);
  const date = dateMatch ? dateMatch[1] : fileName;
  
  return {
    slug: fileName,
    title,
    date,
    content,
  };
});

// 按日期排序（新的在前）
posts.sort((a, b) => {
  const aNum = parseInt(a.date.replace(/\\D/g, "")) || 0;
  const bNum = parseInt(b.date.replace(/\\D/g, "")) || 0;
  return bNum - aNum;
});

function App() {
  return (
    <div className="page">
      <Nav />
      <Routes>
        <Route path="/" element={<Home posts={posts} />} />
        {posts.map((post) => (
          <Route
            key={post.slug}
            path={`/post/${post.slug}`}
            element={<Post title={post.title} mdContent={post.content} />}
          />
        ))}
      </Routes>
      <footer className="site-footer">
        <div className="container">© 2026 My Blog</div>
      </footer>
    </div>
  );
}

export default App;
