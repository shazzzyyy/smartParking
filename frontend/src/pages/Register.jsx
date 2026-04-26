import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, setSession } from "../api";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", phone: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const change = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await api.register(form);
      setSession(user);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#2a3b52] relative overflow-hidden">
      <div className="absolute inset-0 flex flex-col">
        <div className="flex-1 bg-gradient-to-b from-[#324865] to-[#1f2d44]" />
        <div className="h-[38%] bg-gradient-to-b from-[#cabf9e] to-[#b6a880]" />
      </div>

      <div className="absolute top-20 left-1/4 w-[500px] h-[500px] rounded-full bg-white/5 blur-3xl bg-drift pointer-events-none" />

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
        <div className="lg:col-span-6 lg:col-start-2 anim-fade-up delay-400">
          <div className="bg-[#1e2d44]/95 backdrop-blur rounded-2xl shadow-2xl overflow-hidden border border-white/10">
            <form onSubmit={submit} className="px-8 py-8 space-y-5">
              <Field label="FULL NAME" value={form.fullName} onChange={change("fullName")} placeholder="Shahzaib Saeed" delay="600" />
              <Field label="EMAIL" type="email" value={form.email} onChange={change("email")} placeholder="user@email.com" delay="700" />
              <Field label="PHONE" value={form.phone} onChange={change("phone")} placeholder="03001234567" delay="750" />
              <Field label="PASSWORD" type="password" value={form.password} onChange={change("password")} placeholder="••••••••" delay="800" />

              {error && (
                <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-sweep w-full bg-white disabled:opacity-60 text-[#1e2d44] font-black tracking-[0.25em] py-3.5 rounded-lg shadow-xl anim-fade-up delay-900 flex items-center justify-center gap-2"
              >
                <span>{loading ? "CREATING…" : "CREATE ACCOUNT"}</span>
                {!loading && <span className="arrow-slide inline-block">→</span>}
              </button>
            </form>

            <div className="bg-gradient-to-b from-[#cabf9e] to-[#b6a880] px-8 py-5 flex items-center justify-between">
              <div className="text-sm text-[#1e2d44]">Already have an account?</div>
              <Link to="/login" className="btn-sweep bg-[#1e2d44] hover:bg-[#2a3b52] text-white text-xs font-black tracking-[0.25em] px-5 py-2.5 rounded-lg">
                SIGN IN
              </Link>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 lg:col-start-9">
          <div className="text-sm tracking-[0.3em] text-slate-300 mb-2 anim-fade-up delay-300">
            GET STARTED
          </div>
          <h1 className="text-6xl lg:text-[110px] font-black leading-[0.9] tracking-tight anim-headline delay-400 text-gradient-anim">
            REG<br />ISTER
          </h1>
          <p className="mt-8 text-sm text-[#1e2d44] max-w-xs anim-fade-up delay-600 leading-relaxed">
            Create your account to book slots.
          </p>
        </div>
      </main>
    </div>
  );
}

function Field({ label, type = "text", value, onChange, placeholder, delay }) {
  return (
    <div className="anim-fade-up" style={{ animationDelay: `${parseInt(delay) / 1000}s` }}>
      <label className="block text-[10px] tracking-[0.3em] text-slate-400 mb-2 font-bold">
        {label}
      </label>
      <input
        type={type}
        required={type !== "tel" && label !== "PHONE"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="input-lift w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/60 focus:bg-white/10"
      />
    </div>
  );
}
