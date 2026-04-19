"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Sparkles, MapPin, Building2, Clock } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function HomePage() {
  const { isSignedIn } = useUser();
  const primaryHref = isSignedIn ? "/dashboard" : "/sign-up";
  const primaryLabel = isSignedIn ? "Open dashboard" : "Start searching";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fafaf7] dark:bg-[#0a0a0f] text-slate-900 dark:text-slate-100">
      <div className="aurora" aria-hidden />
      <div className="absolute inset-0 grid-fade" aria-hidden />

      <Nav isSignedIn={isSignedIn} />

      <section className="relative z-10 mx-auto max-w-6xl px-6 pt-24 pb-28 sm:pt-32 sm:pb-36">
        <div className="mx-auto max-w-3xl text-center">
          <span className="reveal reveal-1 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            <span className="h-px w-8 bg-slate-300 dark:bg-slate-700" />
            Job search, reimagined
            <span className="h-px w-8 bg-slate-300 dark:bg-slate-700" />
          </span>

          <h1 className="reveal reveal-2 mt-8 text-[2.75rem] sm:text-6xl lg:text-7xl font-semibold leading-[1.02] tracking-[-0.035em]">
            The roles you want,
            <br />
            <span className="font-serif-display italic font-normal text-transparent bg-clip-text bg-gradient-to-r from-violet-600 via-indigo-500 to-sky-500 dark:from-violet-300 dark:via-indigo-300 dark:to-sky-300">
              quietly found
            </span>{" "}
            for you.
          </h1>

          <p className="reveal reveal-3 mx-auto mt-8 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
            One conversation. Every major job board. A thoughtful assistant that reads between the lines and surfaces only the openings worth your morning coffee.
          </p>

          <div className="reveal reveal-4 mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="group h-12 rounded-full bg-slate-900 px-6 text-base text-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.6)] hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              <Link href={primaryHref}>
                {primaryLabel}
                <ArrowUpRight className="ml-1.5 h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </Button>
            {!isSignedIn && (
              <Link
                href="/sign-in"
                className="text-sm text-slate-600 underline-offset-4 hover:underline dark:text-slate-400"
              >
                Already have an account? Sign in
              </Link>
            )}
          </div>

          <p className="reveal reveal-5 mt-14 text-xs uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
            searches across
          </p>
          <div className="reveal reveal-5 mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-medium text-slate-500 dark:text-slate-400">
            <span>LinkedIn</span>
            <Dot />
            <span>Indeed</span>
            <Dot />
            <span>RemoteOK</span>
            <Dot />
            <span>Wellfound</span>
            <Dot />
            <span>GitHub Jobs</span>
          </div>
        </div>

        <div className="reveal reveal-5 mt-20 sm:mt-24">
          <ChatPreview />
        </div>
      </section>

      <div className="relative z-10 mx-auto h-px max-w-5xl hairline" />

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <div className="grid gap-14 sm:grid-cols-3 sm:gap-0">
          <FeatureRow
            eyebrow="01"
            title="Ask in plain English"
            body="‘Remote senior React roles at seed-stage startups paying $160k+.’ The assistant reads it like a recruiter would — not a search form."
          />
          <FeatureRow
            eyebrow="02"
            title="One pass across the web"
            body="We fan out across the major boards in parallel. No tab-hopping, no duplicate listings, no stale postings from six months ago."
            bordered
          />
          <FeatureRow
            eyebrow="03"
            title="Signal, not noise"
            body="Each match is scored against what you actually care about — stack, seniority, comp, timezone. You read five jobs, not five hundred."
            bordered
          />
        </div>
      </section>

      <div className="relative z-10 mx-auto h-px max-w-5xl hairline" />

      <section className="relative z-10 mx-auto max-w-4xl px-6 py-28 text-center">
        <h2 className="text-4xl sm:text-5xl font-semibold tracking-[-0.03em] leading-[1.1]">
          Stop scrolling boards.{" "}
          <span className="font-serif-display italic font-normal text-slate-500 dark:text-slate-400">
            Start reading offers.
          </span>
        </h2>
        <p className="mt-6 text-lg text-slate-600 dark:text-slate-400">
          Free to try. No credit card. Cancel in one click.
        </p>
        <div className="mt-10">
          <Button
            asChild
            size="lg"
            className="group h-12 rounded-full bg-slate-900 px-7 text-base text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            <Link href={primaryHref}>
              {primaryLabel}
              <ArrowUpRight className="ml-1.5 h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="relative z-10 border-t border-slate-200/70 dark:border-slate-800/70">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Wordmark small /> <span className="opacity-60">— quiet tools for a loud market.</span>
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500">© {new Date().getFullYear()} JobBoard AI</div>
        </div>
      </footer>
    </main>
  );
}

function Nav({ isSignedIn }) {
  return (
    <nav className="relative z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Wordmark />
        <div className="flex items-center gap-5">
          {!isSignedIn ? (
            <>
              <Link
                href="/sign-in"
                className="hidden text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 sm:inline"
              >
                Sign in
              </Link>
              <Button
                asChild
                size="sm"
                className="h-9 rounded-full bg-slate-900 px-4 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
              >
                <Link href="/sign-up">Get started</Link>
              </Button>
            </>
          ) : (
            <Button
              asChild
              size="sm"
              className="h-9 rounded-full bg-slate-900 px-4 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}

function Wordmark({ small = false }) {
  return <Logo variant="icon" height={small ? 24 : 34} priority={!small} />;
}

function Dot() {
  return <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" aria-hidden />;
}

function FeatureRow({ eyebrow, title, body, bordered }) {
  return (
    <div
      className={
        "px-0 sm:px-8 " +
        (bordered ? "sm:border-l sm:border-slate-200/80 dark:sm:border-slate-800/80" : "")
      }
    >
      <div className="font-serif-display text-2xl italic text-slate-400 dark:text-slate-500">
        {eyebrow}
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
        {title}
      </h3>
      <p className="mt-3 text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
        {body}
      </p>
    </div>
  );
}

function ChatPreview() {
  return (
    <div className="relative mx-auto max-w-3xl">
      <div className="pointer-events-none absolute -inset-10 -z-10 rounded-[2.5rem] bg-gradient-to-br from-violet-200/40 via-transparent to-sky-200/40 blur-2xl dark:from-violet-500/10 dark:to-sky-500/10" />

      <div className="tilt-card overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 shadow-[0_40px_80px_-30px_rgba(15,23,42,0.25)] backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/60 dark:shadow-[0_40px_100px_-30px_rgba(0,0,0,0.7)]">
        <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-3 dark:border-slate-800/70">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-300/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/80" />
          </div>
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
            new conversation
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">⌘K</span>
        </div>

        <div className="space-y-5 px-6 py-7 sm:px-8 sm:py-9">
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-slate-900 px-4 py-3 text-[15px] text-white dark:bg-white dark:text-slate-900">
              Remote senior frontend roles at seed-stage startups. React + TypeScript,
              $160k+, hiring this quarter.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-sky-500 text-white">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
            <div className="flex-1 space-y-4">
              <p className="text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
                Scanned 6 boards · 412 postings · 4 strong matches. Here&rsquo;s the top one —
                ask for more if you want to see the rest.
              </p>

              <JobCard />

              <div className="flex flex-wrap gap-2 pt-1">
                {["Show me 3 more", "Only fully remote", "Filter by equity"].map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs text-slate-600 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:border-slate-600"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function JobCard() {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 transition hover:border-slate-300 dark:border-slate-800/80 dark:bg-slate-950/50 dark:hover:border-slate-700">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent opacity-0 transition group-hover:opacity-100" />

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 dark:from-slate-800 dark:to-slate-900 dark:text-slate-300">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-[15px] font-semibold text-slate-900 dark:text-white">
              Senior Frontend Engineer
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Linear · Series B · 34 employees
            </p>
          </div>
        </div>
        <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          94% match
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" /> Remote · Americas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" /> Posted 2 days ago
        </span>
        <span className="font-medium text-slate-700 dark:text-slate-300">$170–210k</span>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {["React", "TypeScript", "Design systems"].map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              {tag}
            </span>
          ))}
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-slate-300">
          View role <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
}
