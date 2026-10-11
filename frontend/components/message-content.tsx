import Markdown, {type Components} from 'react-markdown';

const components: Components = {
  pre: ({children}) => <pre dir="ltr">{children}</pre>,
  code: ({children, className}) => <code dir="ltr" className={className}>{children}</code>,
};

export function MessageContent({content}: {content: string}) {
  return (
    <div className="message-content" dir="auto">
      {/* Parse source directly, including incomplete streams. Never unescape source
          or enable raw HTML: code and intentional Markdown escapes must stay literal. */}
      <Markdown skipHtml components={components}>{content}</Markdown>
    </div>
  );
}
