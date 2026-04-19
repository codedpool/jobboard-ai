"use client";

import { SignUp } from "@clerk/nextjs";
import { Shield, Target, Zap } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function SignUpPage() {
  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[#fafaf7] text-slate-900 dark:bg-[#0a0a0f] dark:text-slate-100">
      <div className="aurora" aria-hidden />
      <div className="absolute inset-0 grid-fade" aria-hidden />

      {/* Form (left on mobile, right on desktop is more common; we mirror sign-in by putting it on the left) */}
      <main className="relative z-10 flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex justify-center lg:hidden">
            <Logo variant="icon" height={64} priority />
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-7 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/60">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold tracking-[-0.02em]">
                Create your account
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Two minutes to set up, then the assistant starts looking.
              </p>
            </div>

            <SignUp
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
            Already have an account?{" "}
            <a
              href="/sign-in"
              className="font-medium text-slate-900 underline-offset-4 hover:underline dark:text-slate-100"
            >
              Sign in
            </a>
          </p>
        </div>
      </main>

      {/* Right rail — brand & editorial tagline */}
      <aside className="relative z-10 hidden flex-col justify-between p-12 lg:flex lg:w-1/2">
        <div className="flex justify-end">
          <Logo variant="icon" height={44} priority />
        </div>

        <div className="max-w-md">
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-[-0.03em] sm:text-5xl">
            The next role,{" "}
            <span className="font-serif-display italic font-normal text-slate-400 dark:text-slate-500">
              quietly found.
            </span>
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
            One conversation. Every major board. A thoughtful assistant that
            reads between the lines and surfaces only the openings worth your
            morning coffee.
          </p>

          <div className="mt-10 space-y-5">
            <RailItem
              Icon={Zap}
              title="Two-minute setup"
              body="Ask in plain English — no forms, no dropdowns, no checkboxes to tick."
            />
            <RailItem
              Icon={Target}
              title="Tailored from day one"
              body="Match scores learn from what you ignore just as much as what you open."
            />
            <RailItem
              Icon={Shield}
              title="Private by default"
              body="No crawler on your resume. No shared profile. Your searches stay yours."
            />
          </div>
        </div>

        <p className="text-right text-xs text-slate-400 dark:text-slate-500">
          © {new Date().getFullYear()} JobBoard AI — quiet tools for a loud market.
        </p>
      </aside>
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
