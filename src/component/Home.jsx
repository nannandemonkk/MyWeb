import { Link } from "react-router-dom";

export default function Home({ posts }) {
  return (
    <main className="container content">
      <div className="post">
        <h2>我的博客</h2>
        <p>欢迎来到我的个人博客，这里记录了我的学习和生活。</p>

        <h3>所有文章</h3>
        <ul className="post-list">
          {posts.map((post) => (
            <li key={post.slug}>
              <span className="post-date">{post.date}</span>
              <Link to={`/post/${post.slug}`} className="post-link">
                {post.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
