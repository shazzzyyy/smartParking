import { Link, useLocation, useNavigate } from "react-router-dom";
import { getSession, setSession } from "../api";

const USER_LINKS = [
  { to: "/dashboard",    label: "Slots" },
  { to: "/reservations", label: "Reservations" },
  { to: "/vehicles",     label: "Vehicles" },
];
const ADMIN_LINKS = [
  { to: "/admin", label: "Admin Console" },
];

export default function Shell({ children }) {
  const user = getSession();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const links = user?.role === "Admin" ? ADMIN_LINKS : USER_LINKS;
  const logout = () => { setSession(null); navigate("/login"); };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-slate-100 flex flex-col">
      <header className="border-b border-white/5 bg-[var(--surface)]/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to={user?.role === "Admin" ? "/admin" : "/dashboard"} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="font-bold tracking-tight">Smart Parking</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {links.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`px-3 py-1.5 text-sm rounded-md transition ${
                    pathname === l.to
                      ? "bg-white/10 text-white font-semibold"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden sm:flex flex-col items-end leading-tight">
                <span className="text-sm font-medium">{user.fullName}</span>
                <span className="text-[11px] text-slate-500">
                  {user.role === "Admin" ? "Administrator" : user.email}
                </span>
              </div>
            )}
            <button onClick={logout} className="btn btn-secondary text-xs px-3 py-1.5">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 fade-in">{children}</main>

      <footer className="border-t border-white/5 text-[11px] text-slate-500">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <span>Smart Parking · Group 8 · DB Lab</span>
          <span>MS SQL Server · Spring Boot · React</span>
        </div>
      </footer>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ title, body, action }) {
  return (
    <div className="card p-12 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      {body && <p className="text-sm text-slate-400 mt-1">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Badge({ status }) {
  const map = {
    Available: "bg-emerald-500/15 text-emerald-300",
    Occupied:  "bg-slate-500/20 text-slate-300",
    Reserved:  "bg-amber-500/15 text-amber-300",
    Maintenance: "bg-red-500/15 text-red-300",
    Booked:    "bg-emerald-500/15 text-emerald-300",
    Completed: "bg-slate-500/20 text-slate-300",
    Cancelled: "bg-red-500/15 text-red-300",
    Paid:      "bg-emerald-500/15 text-emerald-300",
    Unpaid:    "bg-amber-500/15 text-amber-300",
    Pending:   "bg-amber-500/15 text-amber-300",
    Failed:    "bg-red-500/15 text-red-300",
  };
  return <span className={`badge ${map[status] || "bg-white/10 text-slate-300"}`}>{status}</span>;
}
