import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { usePosts } from "../hooks/usePosts";
import { dateKey, formatPostDate, matchesSearch, parsePostDate, POST_TYPES, postType } from "../lib/posts";
import { SCENES } from "../lib/appearance";
import Calendar from "../components/Calendar";
import Icon from "../components/Icon";
import ScenePicker from "../components/ScenePicker";
import WindowIllustration from "../components/WindowIllustration";

const CATEGORIES = [["all", "全部", "/"], ["note", "笔记", "/notes"], ["log", "日志", "/logs"], ["plan", "计划", "/plans"]];
const dust = [[40, 20, 14, -4], [55, 60, 16, -8], [74, 12, 19, -11], [85, 48, 15, -2], [92, 31, 18, -7], [63, 76, 21, -9], [47, 44, 16, -3], [80, 84, 17, -12]];

export default function Home({ category = "all", appearance, onCompose }) {
  const { posts, loading, error, reload } = usePosts();
  const [params, setParams] = useSearchParams();
  const [order, setOrder] = useState("newest");
  const query = (params.get("q") || "").trim();
  const tag = params.get("tag") || "";
  const parsedDate = parsePostDate(params.get("date"));
  const selectedDate = parsedDate ? dateKey(parsedDate) : null;
  const currentScene = SCENES[appearance.scene];
  const categoryInfo = POST_TYPES[category];
  const counts = Object.fromEntries(Object.keys(POST_TYPES).map((key) => [key, posts.filter((post) => postType(post) === key).length]));
  const tags = [...new Set(posts.flatMap((post) => post.tags || []))];
  const filtered = posts.filter((post) => (category === "all" || postType(post) === category) && matchesSearch(post, query) &&
    (!tag || post.tags?.includes(tag)) && (!selectedDate || (parsePostDate(post.date) && dateKey(parsePostDate(post.date)) === selectedDate)))
    .sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      const left = parsePostDate(a.date);
      const right = parsePostDate(b.date);
      if (!left || !right) return left ? -1 : right ? 1 : 0;
      return (right - left) * (order === "newest" ? 1 : -1);
    });
  const hasFilters = Boolean(query || tag || selectedDate || category !== "all");

  function setFilter(key, value) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    });
  }

  return (
    <main className="shell home" id="main-content" tabIndex="-1">
      <title>{`${categoryInfo ? `${categoryInfo.label} · ` : ""}栖间 · 把日子慢慢写下来`}</title>
      <section className="hero" aria-labelledby="hero-title">
        <div className="dust" aria-hidden="true">{dust.map(([x, y, duration, delay], index) => <i key={index} style={{ "--x": `${x}%`, "--y": `${y}%`, "--duration": `${duration}s`, "--delay": `${delay}s` }} />)}</div>
        <div className="hero-copy"><div className="eyebrow">LITTLE NOTES, SLOW DAYS</div>
          <h1 id="hero-title">把日子，<br /><span>慢慢写下来。</span></h1>
          <p className="hero-description">写一点所见所想，留住日常里的微光。<br />也给未来的自己，留一封慢慢读的信。</p>
          <div className="hero-meta"><Icon /><span>南初的个人记录空间</span><span className="small-dot" /><span>{!loading && !error ? `${posts.length} 篇记录，慢慢生长` : "认真生活，自由生长"}</span></div>
        </div>
        <div className="hero-art"><WindowIllustration /><p className="scene-caption"><span className="small-dot" />{currentScene.caption}</p></div>
      </section>
      <div className="content-grid">
        <section className="content-column" id="records" aria-labelledby="records-title">
          <div className="content-heading"><h2 id="records-title">{categoryInfo ? categoryInfo.label : "最近的记录"}<small>{categoryInfo?.description || "一些日常，一些生长"}</small></h2><button className="primary-button" onClick={onCompose}><Icon name="plus" />写点什么</button></div>
          <div className="content-toolbar">
            <nav className="filter-group" aria-label="记录分类">{CATEGORIES.map(([key, label, path]) => <Link key={key} to={`${path}${params.size ? `?${params}` : ""}`} className={`filter-button${category === key ? " active" : ""}`} aria-current={category === key ? "page" : undefined}>{label}{key === "all" && !loading && !error && <span className="filter-count">{posts.length}</span>}</Link>)}</nav>
            <label className="sort-control"><span className="sr-only">记录排序</span><select value={order} onChange={(event) => setOrder(event.target.value)}><option value="newest">日期从新到旧</option><option value="oldest">日期从旧到新</option></select><Icon name="down" /></label>
          </div>
          {hasFilters && <div className="active-filters" aria-label="当前筛选">
            {query && <button onClick={() => setFilter("q", null)}>搜索：{query}<Icon name="close" /></button>}
            {tag && <button onClick={() => setFilter("tag", null)}>#{tag}<Icon name="close" /></button>}
            {selectedDate && <button onClick={() => setFilter("date", null)}>{selectedDate}<Icon name="close" /></button>}
            <span aria-live="polite">{!loading && !error && `${filtered.length} 篇记录`}</span><Link to="/" className="clear-filters">清除筛选</Link>
          </div>}
          {loading ? <div className="feed-loading" role="status"><span className="loading-sprout"><Icon /></span><p>正在翻开你的记录…</p>{[0, 1, 2].map((key) => <div className="skeleton-entry" key={key}><span /><span /><span /></div>)}</div> :
            error ? <div className="empty-state" role="alert"><Icon name="info" /><h3>记录暂时没有送达</h3><p>{error}。请确认后端服务已启动后再试。</p><button className="secondary-button" onClick={reload}>重新加载</button></div> :
              filtered.length === 0 ? <div className="empty-state" role="status"><Icon name="leaf" /><h3>{hasFilters ? "这一页，暂时还是空白。" : "新的记录，会慢慢长出来。"}</h3><p>{category !== "all" && !counts[category] ? `还没有标注为“${categoryInfo.label}”的记录。未标注分类的原有文章都在“全部”中。` : hasFilters ? "换个关键词、分类或日期，找找其他日常。" : "当前没有可展示的 Markdown 记录。"}</p>{hasFilters && <Link className="secondary-button" to="/">看看全部记录<Icon name="arrow" /></Link>}</div> :
                <div className="entry-list">{filtered.map((post, index) => <Entry key={post.slug} post={post} featured={index === 0} onTag={(value) => setFilter("tag", value)} />)}</div>}
          {!loading && !error && filtered.length > 0 && <p className="feed-bottom">日子很长，我们慢慢记录。</p>}
        </section>
        <aside className="sidebar" aria-label="记录日历与小站氛围">
          <Calendar posts={posts} loading={loading} error={error} selectedDate={selectedDate} onSelect={(value) => setFilter("date", value)} />
          <section className="side-card atmosphere-card" aria-labelledby="atmosphere-title"><div className="card-heading"><h2 id="atmosphere-title">窗外与此刻</h2><span className="mini-label">{appearance.mode === "auto" ? "跟随时间" : "手动氛围"}</span></div>
            <div className="atmosphere-current"><Icon name={currentScene.icon} /><time dateTime={appearance.now.toISOString()}>{appearance.now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}</time><span>{currentScene.label}<small>本地时间</small></span></div>
            <p className="atmosphere-copy">{currentScene.copy}</p><ScenePicker appearance={appearance} />
            <button className="time-follow" aria-pressed={appearance.mode === "auto"} onClick={() => appearance.setMode("auto")}><Icon name="clock" />{appearance.mode === "auto" ? "正在跟随本地时间" : "恢复自动跟随时间"}</button><p className="weather-note">实时天气尚未接入，背景仅随时间变化。</p>
          </section>
          <section className="side-card archive-card" aria-labelledby="archive-title"><div className="card-heading"><h2 id="archive-title">随手归档</h2><Icon name="leaf" /></div>
            <div className="archive-categories">{["note", "log", "plan"].map((key) => <Link key={key} to={POST_TYPES[key].path}><Icon name={POST_TYPES[key].icon} /><span>{POST_TYPES[key].label}</span><span>{loading || error ? "—" : counts[key]}</span></Link>)}</div>
            {counts.uncategorized > 0 && <p className="archive-note">另有 {counts.uncategorized} 篇未分类记录，保留在“全部”中。</p>}
            {tags.length > 0 ? <div className="tag-cloud">{tags.map((value) => <button key={value} aria-pressed={tag === value} onClick={() => setFilter("tag", tag === value ? null : value)}># {value}</button>)}</div> : <p className="archive-note">给文章添加标签后，会在这里慢慢聚拢。</p>}
          </section>
          <p className="sidebar-note">「 一隅清静，万物生长。 」</p>
        </aside>
      </div>
    </main>
  );
}

function Entry({ post, featured, onTag }) {
  const info = POST_TYPES[postType(post)];
  const date = parsePostDate(post.date);
  return (
    <article className={`entry${featured ? " featured" : ""}`}>
      {featured && <div className="entry-highlight"><Icon name={post.pinned ? "pin" : "sprout"} />{post.pinned ? "置顶的一点心意" : "翻开其中一页"}</div>}
      <div className="entry-top"><span className={`entry-type type-${postType(post)}`}><Icon name={info.icon} />{info.label}</span><time className="entry-date" dateTime={date ? dateKey(date) : undefined}>{formatPostDate(post.date)}</time></div>
      <h3><Link to={`/posts/${encodeURIComponent(post.slug)}`}>{post.title}<Icon name="arrow" /></Link></h3>
      {post.excerpt && <p className="entry-description">{post.excerpt}</p>}
      <div className="entry-meta">{post.tags?.map((tag) => <button className="tag" key={tag} onClick={() => onTag(tag)}># {tag}</button>)}<span className="read-time"><Icon name="clock" />约 {post.readingMinutes || 1} 分钟阅读</span></div>
      {featured && <svg className="pin-sprig" viewBox="0 0 90 110" fill="none" aria-hidden="true"><path d="M38 105c8-34 9-61 18-94M45 75 25 54M50 56l21-19M53 39 38 22" stroke="currentColor" strokeWidth="1.3" /><path d="M27 56C9 53 8 42 11 34c16 1 24 9 16 22ZM49 76c5-20 17-25 27-22-3 18-13 26-27 22ZM54 43c0-19 10-29 23-28 0 16-7 27-23 28ZM40 25C24 21 23 10 27 3c14 3 21 12 13 22ZM39 94c-17-6-20-17-14-27 16 6 21 16 14 27Z" fill="currentColor" /></svg>}
    </article>
  );
}
