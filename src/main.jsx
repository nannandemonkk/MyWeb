import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
// 必须导入
import { BrowserRouter } from "react-router-dom";
import "antd/dist/reset.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  // 必须用它包裹 App
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
