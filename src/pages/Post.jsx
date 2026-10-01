import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { fetchPost } from "../api";

// 外层只干一件事：把 URL 里的 slug 取出来
export default function Post() {
  const { slug } = useParams();

  // key={slug} —— slug 一变化，React 就当作换了一个全新组件，
  // 把旧的丢掉、重新挂载一份。Article 里的 state 自然归零，
  // 所以不用在 useEffect 里手动 setLoading(true) 去复位。
  return <Article key={slug} slug={slug} />;
}

// 内层才是真正干活的那个
function Article({ slug }) {
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPost(slug)
      .then(setPost) // 成功：存下数据
      .catch((err) => setError(err.message)) // 失败：存下错误
      .finally(() => setLoading(false)); // 不管成败：结束加载
  }, [slug]);

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
