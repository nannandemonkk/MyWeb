import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { usePost } from "../hooks/usePost";
import { useAuth } from "../hooks/useAuth";
import { articleBody, dateKey, formatPostDate, parsePostDate, POST_TYPES, postType } from "../lib/posts";
import Icon from "../components/Icon";

export default function Post() {
  const { slug } = useParams();
  return <Article key={slug} slug={slug} />;
}

function Article({ slug }) {
  const { post, loading, error } = usePost(slug);
  const { user } = useAuth();
  if (loading || error) {
    return <main className="shell reading-page" id="main-content" tabIndex="-1"><title>{`${loading ? "正在翻开记录" : "未能打开记录"} · 栖间`}</title><Link className="back-link" to="/"><Icon name="back" />回到记录</Link><div className="reading-status" role={error ? "alert" : "status"}><Icon name={error ? "info" : "book"} /><h1>{error ? "这一页，暂时没能打开。" : "正在翻开这页记录…"}</h1>{error && <p>{error}</p>}<Link className="secondary-button" to="/">看看其他记录<Icon name="arrow" /></Link></div></main>;
  }
  const info = POST_TYPES[postType(post)];
  const date = parsePostDate(post.date);

  return (
    <main className="shell reading-page" id="main-content" tabIndex="-1">
      <title>{`${post.title} · 栖间`}</title>
      <div className="reading-topline"><Link className="back-link" to={info.path}><Icon name="back" />回到{info.path === "/" ? "全部记录" : info.label}</Link>{user ? <Link className="secondary-button" to={`/manage/posts/${encodeURIComponent(slug)}/edit`}><Icon name="pen" />编辑这篇文章</Link> : <span>给自己一点安静的阅读时间</span>}</div>
      <article className="reading-paper">
        <header className="article-header"><div className={`entry-type type-${postType(post)}`}><Icon name={info.icon} />{info.label}</div><h1>{post.title}</h1>
          <div className="article-meta"><span>南初</span><span className="small-dot" /><time dateTime={date ? dateKey(date) : undefined}>{formatPostDate(post.date)}</time>{post.readingMinutes && <><span className="small-dot" /><span>约 {post.readingMinutes} 分钟阅读</span></>}</div>
          {post.tags?.length > 0 && <div className="tag-cloud">{post.tags.map((tag) => <Link key={tag} className="tag" to={`/?${new URLSearchParams({ tag })}`}># {tag}</Link>)}</div>}
        </header>
        <div className="article-body"><ReactMarkdown>{articleBody(post)}</ReactMarkdown></div>
        <footer className="article-end"><Icon /><p>认真写下的每一页，都算数。</p><Link className="text-button" to="/">继续翻翻其他日常<Icon name="arrow" /></Link></footer>
      </article>
    </main>
  );
}
