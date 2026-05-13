import ReactMarkdown from "react-markdown";
import reactLearning from "../document/1.md?raw";

export default function Post1() {
  return (
    <div className="container content">
      <ReactMarkdown>{reactLearning}</ReactMarkdown>
    </div>
  );
}
