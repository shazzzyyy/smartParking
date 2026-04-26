import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, setSession } from "../api";
import { AuthLayout } from "./Login";

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
    <AuthLayout title="Create account" subtitle="Start booking parking in minutes">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name" value={form.fullName} onChange={change("fullName")} placeholder="Jane Doe" required />
        <Field label="Email" type="email" value={form.email} onChange={change("email")} placeholder="you@example.com" required />
        <Field label="Phone" value={form.phone} onChange={change("phone")} placeholder="03001234567" />
        <Field label="Password" type="password" value={form.password} onChange={change("password")} placeholder="At least 6 characters" required />

        {error && (
          <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? "Creating…" : "Create account"}
        </button>

        <p className="text-center text-sm text-slate-400 pt-2">
          Already registered?{" "}
          <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-medium">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

function Field({ label, type = "text", value, onChange, placeholder, required }) {
  return (
    <div>
      <label className="label">{label}{!required && <span className="text-slate-600 font-normal"> (optional)</span>}</label>
      <input
        type={type}
        className="input"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}
