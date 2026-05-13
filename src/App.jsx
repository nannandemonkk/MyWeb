import "./App.css";
import Home from "./component/Home";
import Nav from "./component/Nav";
function App() {
  return (
    <div className="page">
      {/* 顶部导航 */}
      <Nav />
      {/* 内容区域 */}
      <Home />
      {/* 底部 */}
      <footer className="site-footer">
        <div className="container">© 2025 My Blog</div>
      </footer>
    </div>
  );
}

export default App;
