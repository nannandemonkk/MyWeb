import "./App.css";

import { Route, Routes } from "react-router-dom";
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
      </Routes>
      {/* 底部 */}
      <footer className="site-footer">
        <div className="container">© 2025 My Blog</div>
      </footer>
    </div>
  );
}

export default App;
