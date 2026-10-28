import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { ApiError, createPost, deletePost, fetchAdminPost, updatePost } from "../api";
import { useAuth } from "../hooks/useAuth";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges";
import { contentBytes, emptyPostForm, formatUpdatedAt, formTags, MAX_CONTENT_BYTES, postPayload, postToForm, validatePostForm } from "../lib/editor";
import { formatPostDate, POST_TYPES } from "../lib/posts";
import ApiNotice from "../components/ApiNotice";
import Icon from "../components/Icon";
import SessionRecovery from "../components/SessionRecovery";

function loadedEditor(post) {
  const form = postToForm(post);
  return { post, form, baseline: JSON.stringify(form), loaded: true };
}

export default function Editor() {
  const { slug } = useParams();
  return <PostEditor key={slug ? `existing:${slug}` : "new-post"} slug={slug} />;
}

function PostEditor({ slug }) {
  const auth = useAuth();
  const { expireSession } = auth;
  const navigate = useNavigate();
  const location = useLocation();
  const [editor, setEditor] = useState(() => {
    const form = emptyPostForm();
    return { post: null, form, baseline: JSON.stringify(form), loaded: !slug };
  });
  const [initialError, setInitialError] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(() => typeof location.state?.notice === "string" ? location.state.notice : "");
  const [busy, setBusy] = useState("");
  const [conflict, setConflict] = useState(false);
  const [mode, setMode] = useState("edit");
  const { form, post, loaded } = editor;
  const isNew = !slug;
  const savedStatus = post?.status === "published" ? "published" : "draft";
  const dirty = loaded && JSON.stringify(form) !== editor.baseline;
  const bytes = contentBytes(form.content);
  const tags = formTags(form.tagsText);
  const mutationsDisabled = Boolean(busy) || !auth.user || conflict;
  useUnsavedChanges(dirty);

  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    fetchAdminPost(slug, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setEditor(loadedEditor(data)); })
      .catch((failure) => {
        if (controller.signal.aborted) return;
        setInitialError(failure);
        if (failure.status === 401) expireSession();
      });
    return () => controller.abort();
  }, [expireSession, slug]);

  function change(name, value) {
    if (busy) return;
    setEditor((previous) => ({ ...previous, form: { ...previous.form, [name]: value } }));
    setSuccess("");
  }

  function failedRequest(failure) {
    setError(failure);
    if (failure.status === 401) expireSession();
    if (!isNew && (failure.status === 409 || failure.status === 428)) setConflict(true);
  }

  function returnToManage() {
    if (busy) return;
    if (dirty && !window.confirm("还有未保存的修改。返回文章管理会丢弃这些文字，确定离开吗？")) return;
    navigate("/manage");
  }

  async function reloadFromServer() {
    if (isNew || busy || !auth.user) return;
    if (dirty && !window.confirm("重新加载会丢弃本页未保存的文字，并读取服务器最新版本。请先复制需要保留的内容。确定继续吗？")) return;
    setBusy("reload");
    setError(null);
    setInitialError(null);
    setSuccess("");
    try {
      const latest = await fetchAdminPost(slug);
      setEditor(loadedEditor(latest));
      setConflict(false);
      setSuccess("已重新加载服务器版本。请确认内容后再修改与保存。");
    } catch (failure) {
      if (!loaded) setInitialError(failure);
      failedRequest(failure);
    } finally {
      setBusy("");
    }
  }

  async function save(status) {
    if (mutationsDisabled || !loaded) return;
    setError(null);
    setSuccess("");
    const validation = validatePostForm(form);
    if (validation) { setError(new ApiError(validation)); return; }
    if (!isNew && !post?.version) {
      failedRequest(new ApiError("当前文章缺少版本信息，请重新加载后再保存。", 428));
      return;
    }
    const action = status !== savedStatus ? (status === "published" ? "publish" : "withdraw") : "save";
    setBusy(action);
    try {
      const payload = postPayload(form, status, isNew);
      const saved = isNew ? await createPost(payload, { csrfToken: auth.csrfToken }) : await updatePost(slug, { ...payload, version: post.version }, { csrfToken: auth.csrfToken });
      setEditor(loadedEditor(saved));
      setConflict(false);
      const message = status === "published" ? (savedStatus === "published" && !isNew ? "修改已保存，公开文章已更新。" : "文章已发布，现在可以公开阅读。") : (savedStatus === "published" ? "文章已撤回为草稿，不再公开展示。" : "草稿已保存，仅管理员可见。");
      setSuccess(message);
      if (isNew) navigate(`/manage/posts/${encodeURIComponent(saved.slug)}/edit`, { replace: true, state: { notice: message } });
    } catch (failure) {
      failedRequest(failure);
    } finally {
      setBusy("");
    }
  }

  function withdraw() {
    if (mutationsDisabled) return;
    if (window.confirm("撤回后文章将不再公开展示，并以当前编辑内容保存为草稿。确定撤回为草稿吗？")) save("draft");
  }

  async function permanentlyDelete() {
    if (isNew || mutationsDisabled) return;
    if (!post?.version) {
      failedRequest(new ApiError("当前文章缺少版本信息，请重新加载后再删除。", 428));
      return;
    }
    const warning = `将永久删除「${post.title}」。此操作无法撤销，文章正文也会被删除。${dirty ? "本页未保存的修改也会丢失。" : ""}\n\n确定永久删除吗？`;
    if (!window.confirm(warning)) return;
    setBusy("delete");
    setError(null);
    setSuccess("");
    try {
      await deletePost(slug, post.version, { csrfToken: auth.csrfToken });
      navigate("/manage", { replace: true, state: { notice: "文章已永久删除。" } });
    } catch (failure) {
      failedRequest(failure);
    } finally {
      setBusy("");
    }
  }

  function submit(event) {
    event.preventDefault();
    // A normal save of an already published article must never silently unpublish it.
    save(savedStatus);
  }

  function switchTabFromKeyboard(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? "edit" : event.key === "End" ? "preview" : mode === "edit" ? "preview" : "edit";
    setMode(next);
    document.getElementById(next === "edit" ? "edit-tab" : "preview-tab")?.focus();
  }

  if (!loaded) return <main className="shell editor-page" id="main-content" tabIndex="-1">
    <title>编辑文章 · 栖间</title><button type="button" className="back-link" onClick={returnToManage}><Icon name="back" />返回文章管理</button><SessionRecovery />
    <div className="reading-status" role={initialError ? "alert" : "status"}><Icon name={initialError ? "info" : "book"} /><h1>{initialError ? "暂时没能打开这页文字。" : "正在铺开这页文字…"}</h1>{initialError && <><p>{initialError.message}{initialError.status > 0 ? `（HTTP ${initialError.status}）` : ""}</p><button type="button" className="secondary-button" disabled={Boolean(busy) || !auth.user} onClick={reloadFromServer}>{busy ? "正在加载…" : "重新加载文章"}</button></>}</div>
  </main>;

  return <main className="shell editor-page" id="main-content" tabIndex="-1">
    <title>{`${isNew ? "写点什么" : `编辑：${post.title}`} · 栖间`}</title>
    <button type="button" className="back-link" disabled={Boolean(busy)} onClick={returnToManage}><Icon name="back" />返回文章管理</button>
    <header className="workspace-heading editor-heading"><div><p className="eyebrow">WORDS, AT YOUR OWN PACE</p><h1>{isNew ? "从这一刻，写下一点什么。" : "把这一页，慢慢写好。"}</h1><p>手动保存，不会自动保存。正文只需 Markdown，文章元数据由服务器安全生成。</p></div><div className="editor-state"><span className={`status-badge status-${isNew ? "draft" : savedStatus}`}>{isNew ? "新文章 · 未保存" : savedStatus === "published" ? "已发布" : "草稿"}</span><span className={dirty ? "dirty-indicator" : ""}>{dirty ? "有未保存的修改" : isNew ? "尚未保存到服务器" : "当前没有未保存的修改"}</span></div></header>
    <SessionRecovery />
    <ApiNotice error={error} title={conflict ? "版本已变化，不能直接覆盖" : "这次操作没有完成"} />
    {conflict && <section className="inline-notice conflict-notice" role="alert"><strong>请先重新加载服务器最新版本</strong><p>当前文字已保留。服务器上的文章可能已被其他标签页修改，或当前版本信息缺失。不会自动覆盖或自动重试保存；请先复制需要保留的文字，再重新加载并整理。</p><button type="button" className="secondary-button" disabled={Boolean(busy) || !auth.user} onClick={reloadFromServer}>{busy === "reload" ? "正在重新加载…" : "重新加载最新版本"}<Icon name="arrow" /></button></section>}
    {success && <p className="inline-notice success-notice" role="status"><Icon name="check" />{success}</p>}
    <form className="editor-form" onSubmit={submit} aria-busy={Boolean(busy)}>
      <div className="editor-grid">
        <section className="editor-main" aria-label="文章正文">
          <label className="field title-field"><span>文章标题 <small>{form.title.length}/200</small></span><input name="title" value={form.title} onChange={(event) => change("title", event.target.value)} maxLength={200} required disabled={Boolean(busy)} placeholder="给这一页文字，一个名字" autoComplete="off" /></label>
          <div className="markdown-toolbar"><div className="editor-tabs" role="tablist" aria-label="正文编辑模式" onKeyDown={switchTabFromKeyboard}><button type="button" id="edit-tab" role="tab" aria-selected={mode === "edit"} aria-controls="markdown-panel" tabIndex={mode === "edit" ? 0 : -1} onClick={() => setMode("edit")}><Icon name="pen" />编辑 Markdown</button><button type="button" id="preview-tab" role="tab" aria-selected={mode === "preview"} aria-controls="markdown-panel" tabIndex={mode === "preview" ? 0 : -1} onClick={() => setMode("preview")}><Icon name="book" />预览</button></div><span>未点击保存前，不会写入服务器</span></div>
          <div id="markdown-panel" className="markdown-panel" role="tabpanel" aria-labelledby={mode === "edit" ? "edit-tab" : "preview-tab"}>
            {mode === "edit" ? <label className="markdown-label"><span className="sr-only">Markdown 正文</span><textarea name="content" value={form.content} onChange={(event) => change("content", event.target.value)} disabled={Boolean(busy)} spellCheck="false" placeholder={"写下今天想留下的文字…\n\n## 一个小标题\n\n支持 **加粗**、列表、链接与代码块。"} /></label> : <article className="editor-preview"><header className="article-header"><div className={`entry-type type-${form.type}`}><Icon name={POST_TYPES[form.type].icon} />{POST_TYPES[form.type].label}</div><h1>{form.title || "还没有标题的记录"}</h1><div className="article-meta"><span>南初</span><span className="small-dot" /><span>{formatPostDate(form.date)}</span>{tags.length > 0 && <span>{tags.map((tag) => `#${tag}`).join(" ")}</span>}</div></header><div className="article-body">{form.content ? <ReactMarkdown>{form.content}</ReactMarkdown> : <p className="preview-placeholder">正文还是一张空白纸。切回编辑，慢慢写下去吧。</p>}</div></article>}
          </div>
          <div className={`editor-content-foot${bytes > MAX_CONTENT_BYTES ? " over-limit" : ""}`}><span>Markdown 正文，不含 frontmatter</span><span>{(bytes / 1024).toFixed(1)} / 512 KiB</span></div>
        </section>
        <aside className="editor-sidebar" aria-label="文章元数据">
          <section className="metadata-card"><h2>这一页的归档</h2>
            <label className="field"><span>日期 <small>可留空</small></span><input name="date" type="date" value={form.date} onChange={(event) => change("date", event.target.value)} disabled={Boolean(busy)} /></label>
            <label className="field"><span>分类</span><select name="type" value={form.type} onChange={(event) => change("type", event.target.value)} disabled={Boolean(busy)}>{Object.entries(POST_TYPES).map(([key, info]) => <option value={key} key={key}>{info.label}</option>)}</select></label>
            <label className="field"><span>标签 <small>{tags.length}/20</small></span><input name="tags" value={form.tagsText} onChange={(event) => change("tagsText", event.target.value)} disabled={Boolean(busy)} placeholder="日常, 学习, 小计划" autoComplete="off" /><small>用英文或中文逗号分隔，每个最多 40 字。</small></label>
            <label className="field"><span>手写摘要 <small>{form.customExcerpt.length}/500</small></span><textarea name="excerpt" value={form.customExcerpt} onChange={(event) => change("customExcerpt", event.target.value)} disabled={Boolean(busy)} maxLength={500} rows={4} placeholder="留空时，由正文自动生成摘要" /><small>留空会保持自动摘要，不会把自动生成的摘要固定下来。</small></label>
            <label className="checkbox-field"><input name="pinned" type="checkbox" checked={form.pinned} onChange={(event) => change("pinned", event.target.checked)} disabled={Boolean(busy)} /><span>在公开列表置顶</span><Icon name="pin" /></label>
          </section>
          <section className="metadata-card slug-card"><h2>文章地址</h2>{isNew ? <label className="field"><span>Slug <small>可选</small></span><input name="slug" value={form.slug} onChange={(event) => change("slug", event.target.value)} disabled={Boolean(busy)} placeholder="留空自动生成" autoComplete="off" autoCapitalize="none" spellCheck="false" /><small>留空由服务器生成；创建后不能更改。</small></label> : <><p className="slug-value"><code>{post.slug}</code></p><p>地址不可重命名，避免已分享的链接失效。</p><p>最近保存：{formatUpdatedAt(post.updatedAt)}</p>{savedStatus === "published" && <Link className="text-button" target="_blank" rel="noopener noreferrer" to={`/posts/${encodeURIComponent(post.slug)}`}>在新标签页公开阅读<Icon name="arrow" /></Link>}</>}</section>
        </aside>
      </div>
      <div className="editor-actions"><div className="save-actions"><button className="primary-button" type="submit" disabled={mutationsDisabled}>{busy === "save" ? "正在保存…" : savedStatus === "published" && !isNew ? "保存修改（保持发布）" : "保存草稿"}<Icon name="check" /></button>{isNew || savedStatus === "draft" ? <button className="secondary-button" type="button" disabled={mutationsDisabled} onClick={() => save("published")}>{busy === "publish" ? "正在发布…" : "发布文章"}<Icon name="arrow" /></button> : <button className="secondary-button withdraw-button" type="button" disabled={mutationsDisabled} onClick={withdraw}>{busy === "withdraw" ? "正在撤回…" : "撤回为草稿"}</button>}{!isNew && <button className="text-button reload-button" type="button" disabled={Boolean(busy) || !auth.user} onClick={reloadFromServer}>{busy === "reload" ? "正在重新加载…" : "重新加载"}</button>}</div>{!isNew && <button type="button" className="danger-button" disabled={mutationsDisabled} onClick={permanentlyDelete}>{busy === "delete" ? "正在永久删除…" : "永久删除文章"}</button>}</div>
      <p className="editor-save-note">{savedStatus === "published" && !isNew ? "普通保存会保留已发布状态。只有单独点击“撤回为草稿”，才会停止公开展示。" : "保存草稿仅自己可见；点击“发布文章”后，文章会立即出现在公开记录中。"} 删除不可撤销，保存与删除都带版本校验。</p>
    </form>
  </main>;
}
