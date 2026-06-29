import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { FileText, ArrowRight, Shield, Zap, RefreshCw } from "lucide-react";
import Logo from "@/components/Logo";

export default async function Home() {
  const user = await getCurrentUser();

  // If the user is logged in, redirect them to the dashboard automatically
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="relative flex min-h-screen flex-col justify-between bg-zinc-950 text-zinc-100 antialiased selection:bg-zinc-800 selection:text-white">
      {/* Ambient backgrounds */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-blue-600/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-purple-600/5 blur-3xl pointer-events-none" />

      {/* Navigation */}
      <header className="relative flex h-16 items-center justify-between border-b border-zinc-900/60 px-6 backdrop-blur-md z-10">
        <Logo className="h-6 w-6" />

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-zinc-950 transition-all hover:bg-zinc-200 hover:scale-[1.02] shadow-md shadow-white/5"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero section */}
      <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-20 text-center z-10">
        <div className="max-w-3xl space-y-6">
          {/* <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-950/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-400 shadow-lg shadow-indigo-500/5 animate-pulse">
            <Zap className="h-3.5 w-3.5 text-indigo-400" />
            <span>Phase 3 Live: Real-Time Multi-User Collaboration</span>
          </div> */}

          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl leading-[1.1]">
            Collaborative writing.
            <span className="block bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Perfected online & offline.
            </span>
          </h1>

          <p className="mx-auto max-w-xl text-sm text-zinc-400 sm:text-base leading-relaxed">
            A production-ready distributed writing canvas built with conflict-free Yjs document models, real-time WebSocket syncing, presence indicators, and offline-first Dexie cache.
          </p>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row pt-6">
            <Link
              href="/signup"
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-zinc-950 transition-all hover:bg-zinc-200 hover:scale-[1.02] shadow-lg shadow-white/5"
            >
              <span>Create Account</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/30 px-6 py-3.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white transition-all hover:scale-[1.02] backdrop-blur-xs"
            >
              <span>Access Workspace</span>
            </Link>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="mx-auto mt-24 grid max-w-5xl gap-6 grid-cols-1 sm:grid-cols-3">
          <div className="flex flex-col items-center p-6 rounded-2xl border border-zinc-900/50 bg-zinc-900/10 backdrop-blur-xs text-center hover:border-zinc-800 transition-all">
            <FileText className="h-8 w-8 text-blue-400 mb-3" />
            <h3 className="text-sm font-bold text-zinc-200">Rich Text Canvas</h3>
            <p className="text-xs text-zinc-500 mt-2">
              TipTap integrations supporting headings, blocks, bullet lists, check lists, links, images, and custom table matrices.
            </p>
          </div>
          <div className="flex flex-col items-center p-6 rounded-2xl border border-zinc-900/50 bg-zinc-900/10 backdrop-blur-xs text-center hover:border-zinc-800 transition-all">
            <RefreshCw className="h-8 w-8 text-purple-400 mb-3" />
            <h3 className="text-sm font-bold text-zinc-200">Real-Time Sync</h3>
            <p className="text-xs text-zinc-500 mt-2">
              Collaborate simultaneously with cursor awareness, typing indicators, active presence lists, and role-based permissions.
            </p>
          </div>
          <div className="flex flex-col items-center p-6 rounded-2xl border border-zinc-900/50 bg-zinc-900/10 backdrop-blur-xs text-center hover:border-zinc-800 transition-all">
            <Shield className="h-8 w-8 text-emerald-400 mb-3" />
            <h3 className="text-sm font-bold text-zinc-200">Offline Resilience</h3>
            <p className="text-xs text-zinc-500 mt-2">
              Continue editing offline. All changes cache in IndexedDB and sync automatically without manual conflict resolution when back online.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative flex h-14 items-center justify-between border-t border-zinc-900 px-6 text-[10px] text-zinc-450 z-10">
        <div>
          <span>© 2026 EdTech Canvas. Built by <span className="text-zinc-200 font-semibold">Ajeet Kumar</span>. All rights reserved.</span>
        </div>
        <div className="flex gap-4">
          <a
            href="https://github.com/ajeetk7ev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-white transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://www.linkedin.com/in/ajeet-kumar-98b305259/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-white transition-colors"
          >
            LinkedIn
          </a>
        </div>
      </footer>
    </div>
  );
}
