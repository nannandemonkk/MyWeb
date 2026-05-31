import ReactMarkdown from "react-markdown";
import may_twenty_one from "../document/5.21.md?raw";
import may_twenty_nine from "../document/5.29.md?raw";

export default function Post2() {
  return (
    <div className="container content">
          <div className="post">
              <div className="post-header">
                  <ReactMarkdown>{may_twenty_one}</ReactMarkdown>
                </div>
              
              <div className="post-footer">
                  <ReactMarkdown>{may_twenty_nine}</ReactMarkdown>
                </div>
        </div>
    </div>
  );
}
