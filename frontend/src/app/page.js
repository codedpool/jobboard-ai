"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useUser } from "@clerk/nextjs";

export default function HomePage() {
  const { isSignedIn } = useUser();

  return (
    <main className="flex h-screen flex-col items-center justify-center gap-6 bg-background">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">Job Board AI Aggregator</h1>
        <p className="text-muted-foreground max-w-md">
          Chat-first job search. Aggregate jobs across multiple platforms and
          let an agent keep tracking them for you.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <Link href={isSignedIn ? "/dashboard" : "/sign-in"}>
            {isSignedIn ? "Go to dashboard" : "Sign in to get started"}
          </Link>
        </Button>
        {!isSignedIn && (
          <Button asChild variant="outline">
            <Link href="/sign-up">Create account</Link>
          </Button>
        )}
      </div>
    </main>
  );
}
