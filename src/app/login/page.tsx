"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      login,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      if (result.error.includes("Too many login attempts")) {
        setError("Too many login attempts. Try again in 15 minutes.");
      } else {
        setError("Invalid username/email or password");
      }
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <i className="fa-solid fa-plane-circle-check text-4xl text-primary mb-4" />
          <h1 className="text-2xl font-bold text-foreground">CVG Dashboard</h1>
          <p className="text-sm text-muted-foreground">Line Maintenance Operations</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="login" className="text-sm font-medium text-foreground">
              Username or Email
            </label>
            <div className="relative">
              <i className="fa-solid fa-user absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm" />
              <input
                id="login"
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="admin or admin@cvg.local"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Password
            </label>
            <div className="relative">
              <i className="fa-solid fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm" />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <i className="fa-solid fa-circle-exclamation mr-2" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <span>
                <i className="fa-solid fa-spinner fa-spin mr-2" />
                Signing in...
              </span>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          CVG Line Maintenance Operations
        </p>
      </div>
    </div>
  );
}
