"use client";

import { SignUp } from "@clerk/nextjs";
import { Briefcase, Zap, Target, Shield } from "lucide-react";

export default function SignUpPage() {
  return (
    <div className="relative flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Left side - Sign up form */}
      <div className="flex-1 flex items-center justify-center p-8 relative order-2 lg:order-1">
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
              <h2 className="text-2xl font-bold mb-2">Create your account</h2>
              <p className="text-slate-600 dark:text-slate-400">
                Start your journey to finding the perfect job
              </p>
            </div>
            
            <SignUp
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
            Already have an account?{" "}
            <a href="/sign-in" className="text-blue-600 hover:text-blue-700 font-medium">
              Sign in
            </a>
          </p>
        </div>
      </div>

      {/* Right side - Branding & Info */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden order-1 lg:order-2">
        {/* Premium mesh gradient background */}
        <div className="absolute inset-0 mesh-gradient" />
        <div className="absolute inset-0 noise-texture" />
        
        {/* Floating orbs */}
        <div className="absolute top-32 right-20 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 left-20 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-float-delayed" />
        <div className="absolute top-1/2 right-1/3 w-72 h-72 bg-purple-500/15 rounded-full blur-3xl animate-float-slow" />
        
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
                Start your journey to
                <span className="block mt-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  career success
                </span>
              </h1>
              <p className="text-lg text-slate-600 dark:text-slate-400">
                Join thousands of professionals who found their dream jobs with AI-powered assistance.
              </p>
            </div>

            {/* Feature highlights */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm flex items-center justify-center shadow-sm">
                  <Zap className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Lightning Fast Setup</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Get started in under 2 minutes and begin your job search immediately
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm flex items-center justify-center shadow-sm">
                  <Target className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Personalized Experience</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    AI learns your preferences and finds jobs that truly match your goals
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm flex items-center justify-center shadow-sm">
                  <Shield className="w-5 h-5 text-pink-600" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Secure & Private</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Your data is encrypted and protected with enterprise-grade security
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
    </div>
  );
}
