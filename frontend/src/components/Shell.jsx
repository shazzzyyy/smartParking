import { Link, useLocation, useNavigate } from "react-router-dom";
import { getSession, setSession } from "../api";

const USER_LINKS = [
  { to: "/dashboard",    label: "Dashboard" },
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
  const home = user?.role === "Admin" ? "/admin" : "/dashboard";

  return (
    <div className="min-h-screen bg-[#1f2d44] text-white flex flex-col">
      <header className="border-b border-white/10 bg-[#1f2d44]">
        <div className="px-8 lg:px-14 py-5 flex items-center justify-between anim-slide-down">
          <div className="flex items-center gap-10">
            <Link to={home} className="leading-[1.1]">
              <div className="text-[13px] font-black tracking-[0.15em] text-white">SMART</div>
              <div className="text-[13px] font-black tracking-[0.15em] text-white">PARKING</div>
            </Link>
            <nav className="hidden md:flex items-center gap-7 text-sm">
              {links.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`transition pb-1 ${
                    pathname === l.to
                      ? "text-white font-bold border-b-2 border-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-5 text-sm">
            {user && (
              <>
                <div className="hidden md:block text-right leading-tight">
                  <div className="text-white font-semibold">{user.fullName}</div>
                  <div className="text-slate-400 text-xs tracking-wider">
                    {user.role === "Admin" ? "ADMINISTRATOR" : user.email}
                  </div>
                </div>
                <div className="w-9 h-9 rounded-full bg-[#cabf9e] text-[#1e2d44] flex items-center justify-center font-black">
                  {user.fullName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                </div>
              </>
            )}
            <button
              onClick={logout}
              className="text-xs text-slate-400 hover:text-white tracking-[0.25em]"
            >
              LOGOUT
            </button>
          </div>
        </div>
      </header>

      {children}

      <footer className="bg-[#16202f] border-t border-white/5 anim-fade-up delay-700">
        <div className="px-8 lg:px-14 py-5 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-10 lg:gap-14 flex-wrap">
            <FootStat label="ENGINE" value="MSSQL 2022" />
            <FootStat label="STACK"  value="SPRING · REACT" />
            <FootStat label="GROUP"  value="08" />
            <FootStat label="OPEN"   value="08:00 – 20:00" />
          </div>
          <div className="text-[10px] tracking-[0.4em] text-slate-500">
            SMART PARKING SYSTEM
          </div>
        </div>
      </footer>
    </div>
  );
}

function FootStat({ label, value }) {
  return (
    <div>
      <div className="text-[9px] tracking-[0.3em] text-slate-500 mb-0.5 font-bold">{label}</div>
      <div className="text-sm font-black text-white tracking-wide">{value}</div>
    </div>
  );
}

export function Hero({ kicker, title, subtitle, children }) {
  return (
    <section className="bg-[#1f2d44] px-8 lg:px-14 pt-10 pb-14 anim-fade-up">
      {kicker && (
        <div className="text-xs tracking-[0.4em] text-slate-400 mb-3">{kicker}</div>
      )}
      <div className="flex items-end justify-between flex-wrap gap-6">
        <div>
          <h1 className="text-6xl lg:text-8xl font-black leading-[0.9] tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-4 text-sm text-slate-300 max-w-md leading-relaxed">{subtitle}</p>
          )}
        </div>
        {children && <div className="flex items-end gap-10 text-sm">{children}</div>}
      </div>
    </section>
  );
}

export function HeroStat({ label, value }) {
  return (
    <div>
      <div className="text-[10px] tracking-[0.3em] text-slate-400 mb-1 font-bold">{label}</div>
      <div className="text-2xl font-black text-white tracking-tight">{value}</div>
    </div>
  );
}

export function Cream({ children, className = "" }) {
  return (
    <main className={`flex-1 bg-gradient-to-b from-[#cabf9e] to-[#b6a880] text-[#1e2d44] px-8 lg:px-14 py-12 ${className}`}>
      {children}
    </main>
  );
}

export function Badge({ status }) {
  const map = {
    Available:   "bg-emerald-500/20 text-emerald-900 border-emerald-900/30",
    Occupied:    "bg-[#1e2d44]/15 text-[#1e2d44] border-[#1e2d44]/20",
    Reserved:    "bg-amber-500/20 text-amber-900 border-amber-900/40",
    Maintenance: "bg-red-500/20 text-red-900 border-red-900/30",
    Booked:      "bg-emerald-500/20 text-emerald-900 border-emerald-900/30",
    Completed:   "bg-[#1e2d44]/15 text-[#1e2d44] border-[#1e2d44]/20",
    Cancelled:   "bg-red-500/20 text-red-900 border-red-900/30",
    Paid:        "bg-emerald-500/20 text-emerald-900 border-emerald-900/30",
    Unpaid:      "bg-amber-500/20 text-amber-900 border-amber-900/40",
    Pending:     "bg-amber-500/20 text-amber-900 border-amber-900/40",
    Failed:      "bg-red-500/20 text-red-900 border-red-900/30",
  };
  const cls = map[status] || "bg-white/40 text-[#1e2d44] border-[#1e2d44]/20";
  return (
    <span className={`text-[10px] tracking-widest font-bold px-2 py-1 border ${cls}`}>
      {(status || "—").toUpperCase()}
    </span>
  );
}

export function Empty({ kicker = "EMPTY", title, body, action }) {
  return (
    <div className="text-center py-20">
      <div className="text-[10px] tracking-[0.4em] text-[#1e2d44]/60 mb-2 font-bold">{kicker}</div>
      <h2 className="text-3xl font-black mb-3">{title}</h2>
      {body && <p className="text-sm text-[#1e2d44]/70 max-w-sm mx-auto">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorBox({ msg, onLight }) {
  if (!msg) return null;
  return onLight ? (
    <div className="mb-6 text-xs text-red-900 bg-red-200/60 border border-red-900/30 rounded-lg px-3 py-2">{msg}</div>
  ) : (
    <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{msg}</div>
  );
}
