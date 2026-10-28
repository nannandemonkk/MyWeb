export default function ApiNotice({ error, title = "这次请求没有完成", children }) {
  if (!error) return null;
  return <div className="inline-notice error-notice" role="alert"><strong>{title}</strong><p>{error.message || "请稍后重试。"}</p>{error.status > 0 && <small>HTTP {error.status}</small>}{children}</div>;
}
