import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, setSession } from "../api";
import { AuthScaffold, EyeIcon } from "./Login";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", phone: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const change = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.fullName.trim().length < 2) return setError("Full name is required");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) return setError("Enter a valid email address");
    if (form.password.length < 6) return setError("Password must be at least 6 characters");
    if (form.phone && !/^[0-9+\-\s]{7,15}$/.test(form.phone)) return setError("Phone format invalid");
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
    <AuthScaffold kicker="GET STARTED" title={<>REG<br />ISTER</>} tagline="Create your account to book slots.">
      <form onSubmit={submit} className="px-8 py-8 space-y-5">
        <Field label="FULL NAME" value={form.fullName} onChange={change("fullName")} placeholder="Shahzaib Saeed" delay="600" required />
        <Field label="EMAIL" type="email" value={form.email} onChange={change("email")} placeholder="user@email.com" delay="700" required />
        <Field label="PHONE" value={form.phone} onChange={change("phone")} placeholder="03001234567" delay="750" />
        <Field label="PASSWORD" type="password" value={form.password} onChange={change("password")} placeholder="••••••••" delay="800" required />

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
    </AuthScaffold>
  );
}

function Field({ label, type = "text", value, onChange, placeholder, delay, required }) {
  const [showPw, setShowPw] = useState(false);
  const isPw = type === "password";
  const inputType = isPw && showPw ? "text" : type;
  return (
    <div className="anim-fade-up" style={{ animationDelay: `${parseInt(delay) / 1000}s` }}>
      <label className="block text-[10px] tracking-[0.3em] text-slate-400 mb-2 font-bold">
        {label}{!required && <span className="text-slate-500 font-normal"> (optional)</span>}
      </label>
      <div className="relative">
        <input
          type={inputType}
          required={required}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`input-lift w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 ${isPw ? "pr-12" : ""} text-white placeholder-slate-500 focus:outline-none focus:border-white/60 focus:bg-white/10`}
        />
        {isPw && (
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
          >
            <EyeIcon open={showPw} />
          </button>
        )}
      </div>
    </div>
  );
}
