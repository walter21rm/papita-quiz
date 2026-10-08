import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

const inlineComponents: Components = {
  p: ({ children }) => <>{children}</>,
};

interface MarkdownProps {
  children: string;
  inline?: boolean;
  className?: string;
}

export function Markdown({ children, inline = false, className = "" }: MarkdownProps) {
  const content = (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={inline ? inlineComponents : undefined}
      skipHtml
    >
      {children}
    </ReactMarkdown>
  );
  if (inline) return <span className={`prose-papita ${className}`}>{content}</span>;
  return <div className={`prose-papita ${className}`}>{content}</div>;
}
