import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { School, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await login(username.trim(), password);
    setLoading(false);
    if (res.ok) {
      toast.success("Signed in");
      navigate("/");
    } else {
      setError(res.error || "Login failed");
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_1.1fr] bg-white">
      {/* Left panel */}
      <div className="flex flex-col justify-between p-10 lg:p-14 border-r border-zinc-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#002FA7] text-white rounded-sm flex items-center justify-center">
            <School size={20} strokeWidth={2.25} />
          </div>
          <div>
            <div className="font-display font-bold text-lg leading-none">Scholaris</div>
            <div className="overline text-[9px] mt-1">School Management ERP</div>
          </div>
        </div>

        <div className="max-w-md">
          <div className="overline mb-4">Console access</div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05] mb-4">
            Run your school<br />with clarity.
          </h1>
          <p className="text-zinc-600 leading-relaxed mb-10">
            Class rosters, fee ledgers and printable receipts — everything in one calm, functional interface.
          </p>

          <form onSubmit={onSubmit} className="space-y-4" data-testid="login-form">
            <div>
              <label className="overline block mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                data-testid="login-username"
                autoFocus
                required
                className="w-full h-11 px-3 border border-zinc-300 rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002FA7]/40 focus:border-[#002FA7] transition"
                placeholder="admin"
              />
            </div>
            <div>
              <label className="overline block mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="login-password"
                required
                className="w-full h-11 px-3 border border-zinc-300 rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002FA7]/40 focus:border-[#002FA7] transition"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div className="text-sm text-[#FF3B30] border-l-2 border-[#FF3B30] pl-3 py-1" data-testid="login-error">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              data-testid="login-submit"
              className="btn-primary h-11 px-5 w-full flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
              <ArrowRight size={16} />
            </button>
          </form>

          <div className="mt-8 text-xs text-zinc-500 border-t border-zinc-200 pt-4">
            Default admin — <span className="num">admin / admin123</span>
          </div>
        </div>

        <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">© Scholaris ERP</div>
      </div>

      {/* Right visual */}
      <div className="hidden lg:block relative overflow-hidden bg-zinc-100">
        <img
          src="https://images.unsplash.com/photo-1621192754911-ffe0d95929dd?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzV8MHwxfHNlYXJjaHwyfHxtb2Rlcm4lMjBzY2hvb2wlMjBidWlsZGluZyUyMGFyY2hpdGVjdHVyZXxlbnwwfHx8fDE3ODMwOTk1MDN8MA&ixlib=rb-4.1.0&q=85"
          alt="Modern school building"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-black/10 to-transparent" />
        <div className="absolute bottom-8 left-8 right-8 text-white">
          <div className="overline text-white/80 mb-2">Volume 01 — Console</div>
          <p className="font-display text-2xl font-medium leading-tight max-w-md">
            "Great administration is invisible. It simply works."
          </p>
        </div>
      </div>
    </div>
  );
}
