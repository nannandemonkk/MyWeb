import ReactMarkdown from "react-markdown";

export default function Post({ mdContent}) {
  return (
    <main className="container content">
      <div className="post">
        <ReactMarkdown>{mdContent}</ReactMarkdown>
      </div>
    </main>
  );
}
