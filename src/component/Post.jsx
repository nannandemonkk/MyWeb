import ReactMarkdown from "react-markdown";
export default function Post({ title, mdContent }) {
    return (
    <div>
        <h1>{title}</h1>
        <ReactMarkdown>{mdContent}</ReactMarkdown>
    </div>
    );
}
    