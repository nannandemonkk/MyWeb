import "./App.css";

import { Route, Routes } from "react-router-dom";

import Post1 from "./pages/2026.5.13";
import Post2 from "./pages/2026.5.29";
import Home from "./component/Home";
import Nav from "./component/Nav";

function App() {
  return (
    <div className="page">
      {/* 顶部导航 */}
      <Nav />
      {/* 内容区域 */}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="react-learning" element={<Post1 />} />
        <Route path="may-29" element={<Post2 />} />
      </Routes>
      {/* 底部 */}
      <footer className="site-footer">
        <div className="container">© 2026 My Blog</div>
      </footer>
    </div>
  );
}

export default App;
