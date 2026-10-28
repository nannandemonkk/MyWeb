import path from "node:path";
import { createApp } from "./app.js";

const production = process.env.NODE_ENV === "production" || process.argv.includes("--production");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
const origins = (process.env.APP_ORIGIN || "").split(",").map((origin) => origin.trim()).filter(Boolean);

try {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT 必须为 1–65535 的端口号");
  if (production && (!origins.length || origins.some((origin) => !origin.startsWith("https://")))) {
    throw new Error("生产模式必须设置 APP_ORIGIN=https://你的域名，并通过 HTTPS 访问（会话 Cookie 使用 Secure）。本地预览构建请用 npm run server -- --serve。");
  }
  const proxy = process.env.TRUST_PROXY;
  const app = await createApp({
    allowedOrigins: origins,
    secureCookies: production,
    serveFrontend: production || process.argv.includes("--serve"),
    distDir: path.resolve(process.env.STATIC_DIR || path.join(import.meta.dirname, "../dist")),
    trustProxy: proxy ? (/^\d+$/.test(proxy) ? Number(proxy) : proxy) : false,
  });
  const server = app.listen(port, host, () => {
    console.log(`栖间 Node.js 后端已启动: http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${port}`);
    console.log("首次使用请在本地运行 npm run admin:setup 初始化管理员；重置账号后重启服务。");
  });
  server.on("error", (error) => {
    console.error("后端启动失败:", error.message);
    process.exitCode = 1;
  });
  function shutdown() {
    server.close(() => {});
    const timer = setTimeout(() => server.closeAllConnections(), 10_000);
    timer.unref();
  }
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
} catch (error) {
  console.error("后端启动失败:", error.message);
  process.exitCode = 1;
}
