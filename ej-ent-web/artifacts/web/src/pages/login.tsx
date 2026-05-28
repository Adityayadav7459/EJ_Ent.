import { useState } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff, Loader2, Lock, Sparkles, UserPlus, CheckCircle2 } from "lucide-react";
import { login, register } from "@/lib/api";

type Mode = "signin" | "signup";

export default function Login() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setSuccess(null);
    setEmail("");
    setPassword("");
    setShowPassword(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === "signin") {
        const token = await login(email, password);
        localStorage.setItem("access_token", token);
        navigate("/dashboard");
      } else {
        await register(email, password);
        setSuccess("Account created! You can now sign in.");
        switchMode("signin");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const isSignUp = mode === "signup";

  return (
    <div className="min-h-screen flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-white blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-white blur-2xl" />
        </div>

        <div className="relative">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-semibold text-lg tracking-tight">DataVault</span>
          </div>
        </div>

        <div className="relative space-y-6">
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-white leading-tight">
              Secure. Simple.<br />Organized.
            </h1>
            <p className="text-blue-100 text-lg leading-relaxed max-w-sm">
              Your central hub for storing, managing, and accessing your records — with enterprise-grade security.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-sm">
            {[
              { label: "Records Stored", value: "10M+" },
              { label: "Uptime", value: "99.9%" },
              { label: "Encryption", value: "AES-256" },
              { label: "API Calls/Day", value: "500K+" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/15"
              >
                <div className="text-white font-bold text-xl">{stat.value}</div>
                <div className="text-blue-200 text-sm mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-3">
          <div className="flex -space-x-2">
            {["A", "B", "C"].map((l, i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-white text-xs font-medium backdrop-blur-sm"
              >
                {l}
              </div>
            ))}
          </div>
          <p className="text-blue-100 text-sm">Trusted by thousands of teams worldwide</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <span className="font-semibold text-lg tracking-tight text-foreground">DataVault</span>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">
              {isSignUp ? "Create an account" : "Welcome back"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {isSignUp
                ? "Sign up to start managing your records"
                : "Sign in to access your dashboard"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Success alert */}
            {success && (
              <div className="flex items-start gap-3 p-3.5 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600" />
                <span>{success}</span>
              </div>
            )}

            {/* Error alert */}
            {error && (
              <div className="flex items-start gap-3 p-3.5 bg-destructive/8 border border-destructive/20 rounded-xl text-destructive text-sm">
                <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full h-11 px-3.5 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground text-sm outline-none transition-all focus:ring-2 focus:ring-ring focus:border-transparent"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignUp ? "Choose a password" : "Enter your password"}
                  required
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  className="w-full h-11 px-3.5 pr-11 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground text-sm outline-none transition-all focus:ring-2 focus:ring-ring focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary text-primary-foreground rounded-xl font-medium text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isSignUp ? "Creating account…" : "Signing in…"}
                </>
              ) : isSignUp ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  Create Account
                </>
              ) : (
                "Sign in"
              )}
            </button>

            {/* Mode toggle */}
            <p className="text-center text-sm text-muted-foreground">
              {isSignUp ? (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="text-primary font-medium hover:underline"
                  >
                    Sign in
                  </button>
                </>
              ) : (
                <>
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signup")}
                    className="text-primary font-medium hover:underline"
                  >
                    Sign Up
                  </button>
                </>
              )}
            </p>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Protected by industry-standard JWT authentication
          </p>
        </div>
      </div>
    </div>
  );
}
