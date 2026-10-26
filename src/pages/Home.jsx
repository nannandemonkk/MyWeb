import { Link } from "react-router-dom";
import { usePosts } from "../hooks/usePosts";

export default function Home() {
  // 数据怎么来的？loading 怎么变的？—— 不关这个组件的事，全在 usePosts 里
  const { posts, loading, error } = usePosts();

  // 下面只负责"状态 → 界面"的翻译

  if (loading) {
    return (
      <main className="container home">
        <div className="post">
          <p>加载中…</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container home">
        <div className="post">
          <p>出错了：{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container home">
      <div className="post">
        <h2>我的博客</h2>
        <p>欢迎来到我的个人博客。</p>

        <ul>
          {posts.map((post) => (
            <li key={post.slug}>
              <Link to={`/posts/${post.slug}`}>
                {post.title}({post.date})
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
