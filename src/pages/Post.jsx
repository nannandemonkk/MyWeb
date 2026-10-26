import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { usePost } from "../hooks/usePost";

export default function Post() {
  // 从 URL 取出 slug（如 /posts/2026-09-17 → "2026-09-17"）
  const { slug } = useParams();

  // key={slug} —— slug 一变，React 把这个组件当全新的重新挂载，
  // usePost 里的 state 自然归零（loading 回到 true），不用手动复位
  return < Article key={slug} slug={slug} />;
} 

// 内层：真正用 hook 拿数据、渲染文章
function Article({ slug }) {
  // 数据怎么来的？不关这个组件的事，全在 usePost 里
  const { post, loading, error } = usePost(slug);

  // 下面只负责"状态 → 界面"的翻译

  if (loading) {
    return (
      <main className="container content">
        <div className="post">
          <p>加载中…</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container content">
        <div className="post">
          <p>{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container content">
      <div className="post">
        <ReactMarkdown>{post.content}</ReactMarkdown>
      </div>
    </main>
  );
}
