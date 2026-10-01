import "./App.css";
import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Nav from "./components/Nav";
import Post from "./pages/Post";

function App() {
  return (
    <div>
      
      {/* 导航栏 */}
      <Nav />

      {/* 内容区域 */}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/post/:slug" element={<Post />} />
      </Routes>

      {/* 底部 */}
      <footer className="site-footer">
        <div className="container">© 2026 My Blog</div>
      </footer>
    </div>
  );
}

export default App;
