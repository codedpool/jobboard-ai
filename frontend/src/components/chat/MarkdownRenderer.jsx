"use client";

import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CheckIcon, CopyIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TooltipIconButton } from "@/components/tooltip-icon-button";

const CodeBlock = memo(({ language, children }) => {
  const [isCopied, setIsCopied] = useState(false);
  const code = String(children).replace(/\n$/, "");

  const handleCopy = async () => {
    if (isCopied) return;
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="my-2.5">
      <div className="flex items-center justify-between rounded-t-lg border border-border/50 border-b-0 bg-muted/50 px-3 py-1.5 text-xs">
        <span className="font-medium text-muted-foreground lowercase">
          {language || "code"}
        </span>
        <TooltipIconButton tooltip="Copy code" onClick={handleCopy}>
          {isCopied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
        </TooltipIconButton>
      </div>
      <pre className="overflow-x-auto rounded-t-none rounded-b-lg border border-border/50 border-t-0 bg-muted/30 p-3 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
});

CodeBlock.displayName = "CodeBlock";

const InlineCode = ({ children }) => (
  <code className="rounded-md border border-border/50 bg-muted/50 px-1.5 py-0.5 font-mono text-[0.85em]">
    {children}
  </code>
);

const markdownComponents = {
  h1: ({ className, ...props }) => (
    <h1
      className={cn(
        "mb-2 scroll-m-20 font-semibold text-base first:mt-0 last:mb-0",
        className
      )}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={cn(
        "mt-3 mb-1.5 scroll-m-20 font-semibold text-sm first:mt-0 last:mb-0",
        className
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3
      className={cn(
        "mt-2.5 mb-1 scroll-m-20 font-semibold text-sm first:mt-0 last:mb-0",
        className
      )}
      {...props}
    />
  ),
  h4: ({ className, ...props }) => (
    <h4
      className={cn(
        "mt-2 mb-1 scroll-m-20 font-medium text-sm first:mt-0 last:mb-0",
        className
      )}
      {...props}
    />
  ),
  h5: ({ className, ...props }) => (
    <h5
      className={cn("mt-2 mb-1 font-medium text-sm first:mt-0 last:mb-0", className)}
      {...props}
    />
  ),
  h6: ({ className, ...props }) => (
    <h6
      className={cn("mt-2 mb-1 font-medium text-sm first:mt-0 last:mb-0", className)}
      {...props}
    />
  ),
  a: ({ className, ...props }) => (
    <a
      className={cn(
        "text-primary underline underline-offset-2 hover:text-primary/80",
        className
      )}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn(
        "my-2.5 border-muted-foreground/30 border-l-2 pl-3 text-muted-foreground italic",
        className
      )}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul
      className={cn(
        "my-2 ml-4 list-disc marker:text-muted-foreground [&>li]:mt-1",
        className
      )}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={cn(
        "my-2 ml-4 list-decimal marker:text-muted-foreground [&>li]:mt-1",
        className
      )}
      {...props}
    />
  ),
  li: ({ className, ...props }) => (
    <li className={cn("leading-normal", className)} {...props} />
  ),
  hr: ({ className, ...props }) => (
    <hr className={cn("my-2 border-muted-foreground/20", className)} {...props} />
  ),
  table: ({ className, ...props }) => (
    <div className="my-2 overflow-x-auto">
      <table
        className={cn("w-full border-separate border-spacing-0", className)}
        {...props}
      />
    </div>
  ),
  th: ({ className, ...props }) => (
    <th
      className={cn(
        "bg-muted px-2 py-1 text-left font-medium first:rounded-tl-lg last:rounded-tr-lg",
        className
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td
      className={cn(
        "border-muted-foreground/20 border-b border-l px-2 py-1 text-left last:border-r",
        className
      )}
      {...props}
    />
  ),
  tr: ({ className, ...props }) => (
    <tr
      className={cn(
        "m-0 border-b p-0 first:border-t [&:last-child>td:first-child]:rounded-bl-lg [&:last-child>td:last-child]:rounded-br-lg",
        className
      )}
      {...props}
    />
  ),
  code: ({ className, inline, children, node, ...props }) => {
    // Extract language from className (format: language-xxx)
    const match = /language-(\w+)/.exec(className || "");
    const language = match ? match[1] : "";
    const codeString = String(children);
    
    // Truly inline code: no language class, marked inline, and no newlines
    const isInline = inline && !match && !codeString.includes("\n");
    
    if (isInline) {
      return <InlineCode>{children}</InlineCode>;
    }
    
    return <CodeBlock language={language}>{children}</CodeBlock>;
  },
  pre: ({ children }) => {
    // The pre tag just passes through - CodeBlock handles the wrapping
    return <>{children}</>;
  },
  // Use div instead of p to avoid hydration errors when code blocks are nested
  p: ({ className, children, ...props }) => {
    // Check if children contain block-level elements (like our CodeBlock divs)
    const hasBlockChild = Array.isArray(children)
      ? children.some(
          (child) =>
            child?.type === CodeBlock ||
            child?.props?.node?.tagName === "code"
        )
      : children?.type === CodeBlock;

    if (hasBlockChild) {
      return (
        <div
          className={cn("my-2.5 leading-normal first:mt-0 last:mb-0", className)}
          {...props}
        >
          {children}
        </div>
      );
    }

    return (
      <p
        className={cn("my-2.5 leading-normal first:mt-0 last:mb-0", className)}
        {...props}
      >
        {children}
      </p>
    );
  },
};

export const MarkdownRenderer = memo(({ content }) => {
  if (!content) return null;

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={markdownComponents}
      className="prose prose-sm dark:prose-invert max-w-none"
    >
      {content}
    </ReactMarkdown>
  );
});

MarkdownRenderer.displayName = "MarkdownRenderer";
