import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, setSession } from "../api";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("Enter a valid email address");
      return;
    }
    setLoading(true);
    try {
      const user = await api.login({ email, password });
      setSession(user);
      navigate(user.role === "Admin" ? "/admin" : "/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScaffold kicker="WELCOME BACK" title={<>SIGN<br />IN</>} tagline="Reserve your spot in seconds.">
      <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">
        <div className="anim-fade-up delay-600">
          <label className="block text-[10px] tracking-[0.3em] text-slate-400 mb-2 font-bold">EMAIL</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@email.com"
            className="input-lift w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/60 focus:bg-white/10"
          />
        </div>

        <div className="anim-fade-up delay-700">
          <label className="block text-[10px] tracking-[0.3em] text-slate-400 mb-2 font-bold">PASSWORD</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="input-lift w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/60 focus:bg-white/10"
          />
        </div>

        {error && (
          <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 anim-fade-up">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-sweep w-full bg-white disabled:opacity-60 text-[#1e2d44] font-black tracking-[0.25em] py-3.5 rounded-lg shadow-xl anim-fade-up delay-900 flex items-center justify-center gap-2"
        >
          <span>{loading ? "SIGNING IN…" : "SIGN IN"}</span>
          {!loading && <span className="arrow-slide inline-block">→</span>}
        </button>
      </form>

      <div className="bg-gradient-to-b from-[#cabf9e] to-[#b6a880] px-8 py-5 flex items-center justify-between">
        <div className="text-sm text-[#1e2d44]">No account yet?</div>
        <Link to="/register" className="btn-sweep bg-[#1e2d44] hover:bg-[#2a3b52] text-white text-xs font-black tracking-[0.25em] px-5 py-2.5 rounded-lg">
          REGISTER
        </Link>
      </div>
    </AuthScaffold>
  );
}

export function AuthScaffold({ kicker, title, tagline, children }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#2a3b52] relative overflow-hidden">
      <div className="absolute inset-0 flex flex-col">
        <div className="flex-1 bg-gradient-to-b from-[#324865] to-[#1f2d44]" />
        <div className="h-[38%] bg-gradient-to-b from-[#cabf9e] to-[#b6a880]" />
      </div>

      <div className="absolute top-20 left-1/4 w-[500px] h-[500px] rounded-full bg-white/5 blur-3xl bg-drift pointer-events-none" />
      <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] rounded-full bg-[#cabf9e]/10 blur-3xl bg-drift pointer-events-none" style={{ animationDelay: "4s" }} />

      <nav className="relative z-20 px-8 lg:px-14 pt-7 pb-4 anim-slide-down">
        <div className="flex items-center gap-3">
          <div className="leading-[1.1]">
            <div className="text-[13px] font-black tracking-[0.15em] text-white">SMART</div>
            <div className="text-[13px] font-black tracking-[0.15em] text-white">PARKING</div>
          </div>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot mt-1" />
        </div>
      </nav>

      <main className="relative z-10 flex-1 grid lg:grid-cols-12 gap-8 items-center px-8 lg:px-24 py-10">
        <div className="lg:col-span-6 lg:col-start-2 card-float" style={{ animationDelay: "0.4s, 1.2s" }}>
          <div className="bg-[#1e2d44]/95 backdrop-blur rounded-2xl shadow-2xl overflow-hidden border border-white/10 hover:border-white/20 transition">
            {children}
          </div>
        </div>

        <div className="lg:col-span-4 lg:col-start-9">
          <div className="text-sm tracking-[0.3em] text-slate-300 mb-2 anim-fade-up delay-300">{kicker}</div>
          <h1 className="text-6xl lg:text-[110px] font-black leading-[0.9] tracking-tight anim-headline delay-400 text-gradient-anim">
            {title}
          </h1>
          <p className="mt-8 text-sm text-[#1e2d44] max-w-xs anim-fade-up delay-600 leading-relaxed">{tagline}</p>
        </div>
      </main>
    </div>
  );
}
