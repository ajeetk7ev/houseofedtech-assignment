"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserPlus, AlertCircle, CheckCircle } from "lucide-react";
import Logo from "@/components/Logo";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Registration failed");
      }

      setSuccess(true);
      setIsLoading(false);
      
      // Auto-redirect to login after 2 seconds
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100 antialiased selection:bg-zinc-800 selection:text-white">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <Logo className="h-12 w-12" iconOnly />
          <h1 className="text-2xl font-bold tracking-tight text-white">Create an account</h1>
          <p className="text-sm text-zinc-400">
            Start editing your documents with offline-first support
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-2xl backdrop-blur-md">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-900/50 bg-red-950/20 px-3 py-2.5 text-xs text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-900/50 bg-emerald-950/20 px-3 py-2.5 text-xs text-emerald-400">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>Registration successful! Redirecting to login...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="name" className="text-xs font-semibold text-zinc-400">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ajeet Kumar"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-700"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="email" className="text-xs font-semibold text-zinc-400">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-700"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="text-xs font-semibold text-zinc-400">
                Password (min 6 characters)
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-700"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || success}
              className="flex w-full items-center justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:bg-zinc-600"
            >
              {isLoading ? "Signing up..." : "Sign Up"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-zinc-500">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-zinc-400 hover:text-white underline">
            Log in here
          </Link>
        </p>

        <div className="flex justify-center items-center gap-1.5 text-[10px] text-zinc-600">
          <UserPlus className="h-3 w-3" />
          <span>Stateless Secure Signup Setup</span>
        </div>
      </div>
    </div>
  );
}
