"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";

const suggestions = [
  {
    title: "Find remote jobs",
    description: "Help me find remote developer positions",
    prompt: "Find me remote software developer jobs",
  },
  {
    title: "Backend developer roles",
    description: "Search for Python/Node.js positions",
    prompt: "I'm looking for backend developer positions with Python or Node.js",
  },
  {
    title: "Frontend opportunities",
    description: "React, Vue, or Angular roles",
    prompt: "Show me frontend developer jobs working with React",
  },
  {
    title: "Entry level positions",
    description: "Junior developer or internship roles",
    prompt: "Find junior developer or internship positions",
  },
];

export const ChatWelcome = memo(({ onSuggestionClick }) => {
  return (
    <div className="mx-auto my-auto flex w-full max-w-3xl grow flex-col">
      <div className="flex w-full grow flex-col items-center justify-center">
        <div className="flex size-full flex-col justify-center px-4">
          <h1 className="fade-in slide-in-from-bottom-1 animate-in fill-mode-both font-semibold text-2xl duration-200">
            Hello there!
          </h1>
          <p className="fade-in slide-in-from-bottom-1 animate-in fill-mode-both text-muted-foreground text-xl delay-75 duration-200">
            How can I help you find your next opportunity?
          </p>
        </div>
      </div>
      
      <div className="grid w-full gap-2 pb-4 md:grid-cols-2">
        {suggestions.map((suggestion, index) => (
          <div
            key={suggestion.title}
            className="fade-in slide-in-from-bottom-2 animate-in fill-mode-both duration-200"
            style={{ animationDelay: `${100 + index * 50}ms` }}
          >
            <Button
              variant="ghost"
              className="h-auto w-full flex-wrap items-start justify-start gap-1 rounded-3xl border bg-background px-4 py-3 text-left text-sm transition-colors hover:bg-muted md:flex-col"
              onClick={() => onSuggestionClick?.(suggestion.prompt)}
            >
              <span className="font-medium">{suggestion.title}</span>
              <span className="text-muted-foreground">{suggestion.description}</span>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
});

ChatWelcome.displayName = "ChatWelcome";
