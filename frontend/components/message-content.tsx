import Markdown, {type Components} from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import {useTranslations} from 'next-intl';

const components: Components = {
  table: function MarkdownTable({children}) {
    const t = useTranslations('chat');
    return <div className="message-table" role="region" aria-label={t('tableLabel')} tabIndex={0}><table>{children}</table></div>;
  },
  input: function TaskCheckbox({node, ...props}) {
    const t = useTranslations('chat');
    return <input {...props} aria-label={t(props.checked ? 'completedTask' : 'incompleteTask')} />;
  },
  pre: ({children}) => <pre dir="ltr">{children}</pre>,
  code: ({children, className}) => <code dir="ltr" className={className}>{children}</code>,
  // Math must not determine the surrounding prose's automatic direction.
  span: ({node, ...props}) => <span {...props} dir={
    props.className?.split(' ').some((name) => ['katex', 'katex-display', 'katex-error'].includes(name))
      ? 'ltr' : undefined
  } />,
};

export function MessageContent({content}: {content: string}) {
  return (
    <div className="message-content" dir="auto">
      {/* Parse source directly, including incomplete streams. Never unescape source
          or enable raw HTML: code and intentional Markdown escapes must stay literal. */}
      <Markdown skipHtml components={components} remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[[rehypeKatex, {trust: false}]]}>{content}</Markdown>
    </div>
  );
}
