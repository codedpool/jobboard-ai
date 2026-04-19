"use client";

import { SignIn } from "@clerk/nextjs";
import { Sparkles, TrendingUp, Users } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function SignInPage() {
  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[#fafaf7] text-slate-900 dark:bg-[#0a0a0f] dark:text-slate-100">
      <div className="aurora" aria-hidden />
      <div className="absolute inset-0 grid-fade" aria-hidden />

      {/* Left rail — brand & editorial tagline */}
      <aside className="relative z-10 hidden flex-col justify-between p-12 lg:flex lg:w-1/2">
        <Logo variant="icon" height={44} priority />

        <div className="max-w-md">
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-[-0.03em] sm:text-5xl">
            Welcome back to your{" "}
            <span className="font-serif-display italic font-normal text-slate-400 dark:text-slate-500">
              career journey.
            </span>
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
            Sign back in to keep the assistant working — it remembers your
            preferences, your searches, and the roles you&rsquo;ve already
            dismissed.
          </p>

          <div className="mt-10 space-y-5">
            <RailItem
              Icon={TrendingUp}
              title="Kept in the loop"
              body="Fresh matches across LinkedIn, Indeed, RemoteOK, Wellfound and GitHub Jobs — in one place."
            />
            <RailItem
              Icon={Sparkles}
              title="Signal, not noise"
              body="Each match is scored against the stack, seniority and comp you actually care about."
            />
            <RailItem
              Icon={Users}
              title="Quiet, not loud"
              body="No alerts. No unread counts. Come back when you want to, read five jobs, leave."
            />
          </div>
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500">
          © {new Date().getFullYear()} JobBoard AI — quiet tools for a loud market.
        </p>
      </aside>

      {/* Right — Clerk form */}
      <main className="relative z-10 flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="mb-6 flex justify-center lg:hidden">
            <Logo variant="icon" height={64} priority />
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-7 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/60">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold tracking-[-0.02em]">
                Sign in
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Continue where you left off.
              </p>
            </div>

            <SignIn
              appearance={{
                layout: { logoPlacement: "none" },
                elements: {
                  rootBox: "w-full",
                  card: "bg-transparent shadow-none border-0 p-0",
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                  socialButtonsBlockButton:
                    "bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-none rounded-xl",
                  formButtonPrimary:
                    "bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-xl shadow-none",
                  footerActionLink:
                    "text-slate-900 dark:text-slate-100 font-medium underline-offset-4 hover:underline",
                  formFieldInput:
                    "bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 rounded-xl",
                  identityPreviewEditButton:
                    "text-slate-900 dark:text-slate-100",
                },
              }}
            />
          </div>

          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            New here?{" "}
            <a
              href="/sign-up"
              className="font-medium text-slate-900 underline-offset-4 hover:underline dark:text-slate-100"
            >
              Create an account
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}

function RailItem({ Icon, title, body }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/70 text-slate-700 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900/60 dark:text-slate-200 dark:ring-slate-800/70">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{body}</p>
      </div>
    </div>
  );
}
