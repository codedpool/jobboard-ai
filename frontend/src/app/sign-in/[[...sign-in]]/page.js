"use client";

import { SignIn } from "@clerk/nextjs";
import { Briefcase, TrendingUp, Users, Sparkles } from "lucide-react";

export default function SignInPage() {
  return (
    <div className="relative flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Left side - Branding & Info */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Premium mesh gradient background */}
        <div className="absolute inset-0 mesh-gradient" />
        <div className="absolute inset-0 noise-texture" />
        
        {/* Floating orbs */}
        <div className="absolute top-20 left-20 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-32 right-20 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-float-delayed" />
        <div className="absolute top-1/2 left-1/3 w-72 h-72 bg-pink-500/15 rounded-full blur-3xl animate-float-slow" />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-slate-900 dark:text-white">
          {/* Logo/Brand */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold">JobBoard AI</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm ml-13">
              Your intelligent job search companion
            </p>
          </div>

          {/* Main content */}
          <div className="space-y-8 max-w-md">
            <div>
              <h1 className="text-4xl font-bold mb-4 leading-tight">
                Welcome back to your
                <span className="block mt-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  career journey
                </span>
              </h1>
              <p className="text-lg text-slate-600 dark:text-slate-400">
                Sign in to continue discovering opportunities tailored just for you.
              </p>
            </div>

            {/* Feature highlights */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm flex items-center justify-center shadow-sm">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Real-time Job Tracking</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Stay updated with the latest opportunities across multiple platforms
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm flex items-center justify-center shadow-sm">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">AI-Powered Matching</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Get personalized recommendations based on your skills and preferences
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm flex items-center justify-center shadow-sm">
                  <Users className="w-5 h-5 text-pink-600" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Trusted by Thousands</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Join professionals who found their dream jobs through our platform
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-sm text-slate-500 dark:text-slate-500">
            © 2024 JobBoard AI. Empowering careers with intelligence.
          </div>
        </div>
      </div>

      {/* Right side - Sign in form */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        {/* Mobile background */}
        <div className="absolute inset-0 lg:hidden mesh-gradient opacity-30" />
        <div className="absolute inset-0 lg:hidden noise-texture" />
        
        <div className="w-full max-w-md relative z-10">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            <div className="inline-flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold">JobBoard AI</span>
            </div>
          </div>

          <div className="premium-glass rounded-3xl p-8 shadow-2xl">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">Sign in</h2>
              <p className="text-slate-600 dark:text-slate-400">
                Continue your job search journey
              </p>
            </div>
            
            <SignIn
              appearance={{
                layout: {
                  logoPlacement: "none",
                },
                elements: {
                  rootBox: "w-full",
                  card: "bg-transparent shadow-none",
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                  socialButtonsBlockButton: "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-sm transition-all",
                  formButtonPrimary: "bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all",
                  footerActionLink: "text-blue-600 hover:text-blue-700 font-medium",
                  formFieldInput: "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700",
                  identityPreviewEditButton: "text-blue-600 hover:text-blue-700",
                },
              }}
            />
          </div>

          <p className="text-center text-sm text-slate-600 dark:text-slate-400 mt-6">
            Don't have an account?{" "}
            <a href="/sign-up" className="text-blue-600 hover:text-blue-700 font-medium">
              Sign up for free
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
