import ReactMarkdown from "react-markdown";

export default function Post({ mdContent, title }) {
  return (
    <main className="container content">
      <div className="post">
        <h1 className="post-title">{title}</h1>
        <ReactMarkdown>{mdContent}</ReactMarkdown>
      </div>
    </main>
  );
}
