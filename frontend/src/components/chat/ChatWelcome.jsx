"use client";

import { memo } from "react";
import { Laptop, Code, Sparkles, Briefcase, ArrowUpRight } from "lucide-react";

const suggestions = [
  {
    title: "Remote roles",
    hint: "full-time, anywhere in the world",
    prompt: "Find me remote software developer jobs",
    icon: Laptop,
  },
  {
    title: "Backend engineering",
    hint: "Python, Node.js or Go",
    prompt: "I'm looking for backend developer positions with Python or Node.js",
    icon: Code,
  },
  {
    title: "Frontend engineering",
    hint: "React, Vue or Angular",
    prompt: "Show me frontend developer jobs working with React",
    icon: Sparkles,
  },
  {
    title: "Early-career",
    hint: "junior, new-grad & internships",
    prompt: "Find junior developer or internship positions",
    icon: Briefcase,
  },
];

function greetingFor(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Working late";
}

export const ChatWelcome = memo(({ onSuggestionClick }) => {
  const greeting = greetingFor();

  return (
    <div className="mx-auto flex w-full max-w-3xl grow flex-col justify-center px-4 pb-8">
      <div className="fade-in slide-in-from-bottom-1 animate-in fill-mode-both duration-500">
        <h1 className="text-4xl sm:text-5xl font-semibold leading-[1.05] tracking-[-0.03em] text-slate-900 dark:text-white">
          {greeting}.
          <br />
          <span className="font-serif-display italic font-normal text-slate-400 dark:text-slate-500">
            what are we looking for?
          </span>
        </h1>
        <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
          Describe the kind of role you want. Stack, seniority, location, comp —
          anything you&rsquo;d tell a thoughtful recruiter. I&rsquo;ll do the
          scanning.
        </p>
      </div>

      <div className="mt-10 grid gap-2 sm:grid-cols-2">
        {suggestions.map((s, index) => {
          const Icon = s.icon;
          return (
            <button
              key={s.title}
              onClick={() => onSuggestionClick?.(s.prompt)}
              className="fade-in slide-in-from-bottom-2 animate-in fill-mode-both duration-500 group flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white/50 px-4 py-3 text-left transition hover:border-slate-300 hover:bg-white dark:border-slate-800/80 dark:bg-slate-900/30 dark:hover:border-slate-700 dark:hover:bg-slate-900/60"
              style={{ animationDelay: `${120 + index * 60}ms` }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition group-hover:bg-slate-900 group-hover:text-white dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-white dark:group-hover:text-slate-900">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-900 dark:text-white">
                    {s.title}
                  </div>
                  <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {s.hint}
                  </div>
                </div>
              </div>
              <ArrowUpRight
                className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-slate-900 dark:group-hover:text-white"
                strokeWidth={1.75}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
});

ChatWelcome.displayName = "ChatWelcome";
