import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPosts } from "../api";

export default function Home() {
  // 三样东西：数据、还在不在加载、有没有出错
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 组件第一次显示出来的时候，去后端要数据
  useEffect(() => {
    fetchPosts()
      .then(setPosts)                         // 成功：把数据存进状态
      .catch((err) => setError(err.message))  // 失败：记住错误信息
      .finally(() => setLoading(false));      // 不管成败：不再加载了
  }, []);                                     // [] = 只在第一次执行一次

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

      </div>
    </main>
  );
}
