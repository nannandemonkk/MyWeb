import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { fetchAdminPosts } from "../api";
import { useAuth } from "../hooks/useAuth";
import { formatPostDate, POST_TYPES, postType } from "../lib/posts";
import { formatUpdatedAt } from "../lib/editor";
import ApiNotice from "../components/ApiNotice";
import Icon from "../components/Icon";

const FILTERS = [["all", "全部文章"], ["draft", "草稿"], ["published", "已发布"]];

export default function Manage() {
  const { expireSession } = useAuth();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const requestedStatus = params.get("status");
  const status = FILTERS.some(([value]) => value === requestedStatus) ? requestedStatus : "all";
  const [revision, setRevision] = useState(0);
  const requestKey = `${status}:${location.key}:${revision}`;
  const [result, setResult] = useState({ key: null, posts: [], error: null });
  const loading = result.key !== requestKey;
  const error = loading ? null : result.error;
  const posts = result.posts;
  const notice = typeof location.state?.notice === "string" ? location.state.notice : "";

  useEffect(() => {
    const controller = new AbortController();
    fetchAdminPosts(status, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setResult({ key: requestKey, posts: data, error: null }); })
      .catch((failure) => {
        if (controller.signal.aborted) return;
        if (failure.status === 401) expireSession();
        setResult({ key: requestKey, posts: [], error: failure });
      });
    return () => controller.abort();
  }, [expireSession, requestKey, status]);

  function filter(value) {
    setParams(value === "all" ? {} : { status: value });
  }

  return <main className="shell manage-page" id="main-content" tabIndex="-1">
    <title>文章管理 · 栖间</title>
    <Link className="back-link" to="/"><Icon name="back" />回到公开记录</Link>
    <header className="workspace-heading"><div><p className="eyebrow">YOUR QUIET DESK</p><h1>让每一页文字，都有安放。</h1><p>草稿只留给自己，发布后会出现在公开记录中。所有修改都需要手动保存。</p></div><Link className="primary-button" to="/write"><Icon name="plus" />写一篇新记录</Link></header>
    {notice && <p className="inline-notice success-notice" role="status"><Icon name="check" />{notice}</p>}
    <section className="manage-panel" aria-labelledby="manage-list-title" aria-busy={loading}>
      <div className="manage-toolbar"><h2 className="sr-only" id="manage-list-title">管理文章列表</h2><div className="manage-filters" role="group" aria-label="文章发布状态">{FILTERS.map(([value, label]) => <button type="button" key={value} className={`filter-button${status === value ? " active" : ""}`} aria-pressed={status === value} onClick={() => filter(value)}>{label}</button>)}</div><button type="button" className="text-button" disabled={loading} onClick={() => setRevision((value) => value + 1)}><Icon name="clock" />刷新列表</button></div>
      {loading ? <div className="workspace-empty" role="status"><Icon name="book" /><h2>正在整理你的文字…</h2><p>稍等片刻，草稿与已发布记录很快就来。</p></div> : error ? <div className="manage-error"><ApiNotice error={error} title="文章列表暂时没有送达"><button type="button" className="secondary-button" onClick={() => setRevision((value) => value + 1)}>重新加载</button></ApiNotice></div> : posts.length === 0 ? <div className="workspace-empty" role="status"><Icon name="leaf" /><h2>{status === "draft" ? "没有待整理的草稿。" : status === "published" ? "还没有公开的记录。" : "先从第一行文字开始。"}</h2><p>{status === "draft" ? "想法可以先写成草稿，等准备好了再发布。" : status === "published" ? "发布后的文章会在这里，也会出现在公开阅读页。" : "一篇笔记、一段日常，或一个小小的计划。"}</p><Link className="secondary-button" to="/write">写点什么<Icon name="arrow" /></Link></div> : <>
        <p className="manage-count" role="status">共 {posts.length} 篇{status === "draft" ? "草稿" : status === "published" ? "已发布记录" : "文章"}</p>
        <ul className="manage-list">{posts.map((post) => {
          const info = POST_TYPES[postType(post)];
          return <li className="manage-entry" key={post.slug}>
            <div className="manage-entry-main"><div className="manage-entry-labels"><span className={`status-badge status-${post.status}`}>{post.status === "published" ? "已发布" : "草稿"}</span><span className={`entry-type type-${postType(post)}`}><Icon name={info.icon} />{info.label}</span>{post.pinned && <span className="entry-type"><Icon name="pin" />置顶</span>}</div>
              <h2><Link to={`/manage/posts/${encodeURIComponent(post.slug)}/edit`}>{post.title}</Link></h2>
              {post.excerpt && <p className="manage-excerpt">{post.excerpt}</p>}
              <div className="manage-entry-meta"><span>{formatPostDate(post.date)}</span><span>最近修改：{formatUpdatedAt(post.updatedAt)}</span>{post.tags?.length > 0 && <span>{post.tags.map((tag) => `#${tag}`).join(" ")}</span>}</div>
            </div>
            <div className="manage-entry-actions"><Link className="secondary-button" to={`/manage/posts/${encodeURIComponent(post.slug)}/edit`}><Icon name="pen" />编辑</Link>{post.status === "published" && <Link className="text-button" to={`/posts/${encodeURIComponent(post.slug)}`}>公开阅读<Icon name="arrow" /></Link>}</div>
          </li>;
        })}</ul>
      </>}
    </section>
  </main>;
}
