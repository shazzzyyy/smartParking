import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, getSession, setSession } from "../api";
import BookingModal from "../components/BookingModal";

const NAV = ["Dashboard", "Reservations"];

export default function Dashboard() {
  const navigate = useNavigate();
  const user = getSession();

  const [slots, setSlots] = useState([]);
  const [locations, setLocations] = useState([]);
  const [pricing, setPricing] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [location, setLocation] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [showBooking, setShowBooking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    (async () => {
      try {
        const [ss, ls, pr, vs] = await Promise.all([
          api.slots(),
          api.locations(),
          api.pricing(),
          api.myVehicles(user.userId),
        ]);
        setSlots(ss);
        setLocations(ls);
        setPricing(pr);
        setVehicles(vs);
        if (ls.length > 0) setLocation(ls[0]);
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const refreshSlots = async () => {
    try {
      const ss = await api.slots();
      setSlots(ss);
    } catch (e) { setErr(e.message); }
  };

  const logout = () => { setSession(null); navigate("/login"); };

  const shown = slots.filter((s) => s.location === location);
  const selectedSlot = slots.find((s) => s.slotId === selectedId);
  const priceFor = (type) => {
    const p = pricing.find((x) => x.type === type);
    return p ? Number(p.pricePerHour) : 0;
  };
  const rate = selectedSlot ? priceFor(selectedSlot.type) : 0;

  const available = slots.filter((s) => s.status === "Available").length;
  const occupied = slots.filter((s) => s.status === "Occupied").length;
  const reserved = slots.filter((s) => s.status === "Reserved").length;

  const [active, setActive] = useState("Dashboard");

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#1f2d44] text-white flex flex-col">
      {/* ========= TOP BAR (matches login nav) ========= */}
      <header className="border-b border-white/10 bg-[#1f2d44]">
        <div className="px-8 lg:px-14 py-5 flex items-center justify-between anim-slide-down">
          <div className="flex items-center gap-10">
            <div className="leading-[1.1]">
              <div className="text-[13px] font-black tracking-[0.15em] text-white">SMART</div>
              <div className="text-[13px] font-black tracking-[0.15em] text-white">PARKING</div>
            </div>
            <nav className="hidden md:flex items-center gap-7 text-sm">
              <Link
                to="/dashboard"
                className={`transition pb-1 ${
                  active === "Dashboard"
                    ? "text-white font-bold border-b-2 border-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/reservations"
                className="text-slate-400 hover:text-slate-200 transition pb-1"
              >
                Reservations
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-5 text-sm">
            <div className="hidden md:block text-right leading-tight">
              <div className="text-white font-semibold">{user.fullName}</div>
              <div className="text-slate-400 text-xs tracking-wider">{user.email}</div>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#cabf9e] text-[#1e2d44] flex items-center justify-center font-black">
              {user.fullName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <button
              onClick={logout}
              className="text-xs text-slate-400 hover:text-white tracking-[0.25em]"
            >
              LOGOUT
            </button>
          </div>
        </div>
      </header>

      {/* ========= HERO (dark) ========= */}
      <section className="bg-[#1f2d44] px-8 lg:px-14 pt-10 pb-14 anim-fade-up">
        <div className="text-xs tracking-[0.4em] text-slate-400 mb-3">
          {selectedSlot
            ? `NO. ${selectedSlot.slotNumber} · ${selectedSlot.location.toUpperCase()} · ${selectedSlot.type.toUpperCase()}`
            : "SELECT A SLOT"}
        </div>
        <div className="flex items-end justify-between flex-wrap gap-6">
          <div>
            <h1 className="text-6xl lg:text-8xl font-black leading-[0.9] tracking-tight">
              {selectedSlot ? `SLOT ${selectedSlot.slotNumber}` : "PICK A SLOT"}
            </h1>
            <p className="mt-4 text-sm text-slate-300 max-w-sm leading-relaxed">
              {selectedSlot
                ? "Selected spot. Review your booking below, then confirm."
                : "Click any available slot from the grid below."}
            </p>
            {err && (
              <div className="mt-3 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 inline-block">
                {err}
              </div>
            )}
          </div>

          <div className="flex items-end gap-10 text-sm">
            <HeroStat label="AVAILABLE" value={available} />
            <HeroStat label="OCCUPIED" value={occupied} />
            <HeroStat label="RESERVED" value={reserved} />
            <HeroStat label="RATE" value={selectedSlot ? `Rs ${rate}/h` : "—"} />
          </div>
        </div>
      </section>

      {/* ========= MAIN (cream) ========= */}
      <main className="flex-1 bg-gradient-to-b from-[#cabf9e] to-[#b6a880] text-[#1e2d44] px-8 lg:px-14 py-12">
        <div className="grid lg:grid-cols-12 gap-10">
          {/* LEFT — SLOT GRID */}
          <section className="lg:col-span-8 anim-fade-up delay-200">
            <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
              <div>
                <div className="text-[10px] tracking-[0.4em] text-[#1e2d44]/60 mb-1 font-bold">
                  LIVE VIEW
                </div>
                <h2 className="text-3xl font-black tracking-tight">Parking Layout</h2>
              </div>
            </div>

            {/* Location tabs (from SlotLocation in schema) */}
            <div className="flex gap-2 mb-5 flex-wrap">
              {locations.map((loc) => (
                <button
                  key={loc}
                  onClick={() => setLocation(loc)}
                  className={`px-4 py-2 rounded-full text-[11px] font-black tracking-widest transition ${
                    location === loc
                      ? "bg-[#1e2d44] text-white shadow-md"
                      : "bg-white/40 text-[#1e2d44] hover:bg-white/60 border border-[#1e2d44]/10"
                  }`}
                >
                  {loc.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-5 mb-5 text-[11px] tracking-widest text-[#1e2d44]/70 font-bold">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-white/40 border border-[#1e2d44]/20" />
                AVAILABLE
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-[#1e2d44]" />
                SELECTED
              </span>
              <span className="flex items-center gap-2">
                <CarTopIcon className="w-3 h-3" />
                OCCUPIED
              </span>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-2.5 bg-white/20 rounded-2xl p-3.5 border border-[#1e2d44]/10 min-h-[200px]">
              {loading && (
                <div className="col-span-full text-center py-12 text-[#1e2d44]/60 text-sm tracking-widest">
                  LOADING SLOTS…
                </div>
              )}
              {!loading && shown.length === 0 && (
                <div className="col-span-full text-center py-12 text-[#1e2d44]/60 text-sm tracking-widest">
                  NO SLOTS AT {location.toUpperCase()}
                </div>
              )}
              {shown.map((slot) => (
                <SlotCell
                  key={slot.slotId}
                  slot={slot}
                  isSelected={selectedId === slot.slotId}
                  onClick={() => slot.status === "Available" && setSelectedId(slot.slotId)}
                />
              ))}
            </div>

            <button
              onClick={() => selectedSlot && setShowBooking(true)}
              disabled={!selectedSlot || selectedSlot.status !== "Available"}
              className="mt-6 w-full bg-[#1e2d44] hover:bg-[#2a3b52] disabled:opacity-40 disabled:cursor-not-allowed text-white font-black tracking-[0.3em] py-4 shadow-xl transition"
            >
              {selectedSlot ? `PARK AT SLOT ${selectedSlot.slotNumber} →` : "SELECT A SLOT"}
            </button>
          </section>

          {/* RIGHT — Booking details */}
          <aside className="lg:col-span-4 space-y-6">
            {/* ===== LOCATION CARD ===== */}
            <div className="bg-[#1e2d44] text-white anim-fade-up delay-300">
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <Pill>{selectedSlot?.location || location || "—"}</Pill>
                  <Pill>№ {selectedSlot?.slotNumber || "—"}</Pill>
                  <Pill>{selectedSlot?.type || "—"}</Pill>
                </div>
                <h3 className="text-2xl font-black leading-tight mb-1">
                  FAST-NUCES Main Parking
                </h3>
                <p className="text-xs text-slate-400 tracking-wide mb-5">
                  Rs {selectedSlot ? priceFor(selectedSlot.type) : "—"} / hour · Mon–Sat, 08:00 – 20:00
                </p>

                <button
                  onClick={() => selectedSlot && setShowBooking(true)}
                  disabled={!selectedSlot || selectedSlot.status !== "Available"}
                  className="w-full bg-[#cabf9e] hover:bg-[#b6a880] disabled:opacity-40 disabled:cursor-not-allowed text-[#1e2d44] font-black tracking-[0.25em] py-3 transition"
                >
                  START PARKING
                </button>
              </div>

              {/* Vehicle strip at bottom */}
              {vehicles.length > 0 && (
                <div className="flex items-center gap-3 px-5 py-4 border-t border-white/10 bg-[#16202f]">
                  <div className="w-10 h-14 flex items-center justify-center">
                    <CarTopIcon className="w-7 h-12" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] tracking-[0.3em] text-slate-500 font-bold">VEHICLE</div>
                    <div className="text-sm font-black leading-tight">
                      {vehicles[0].brand} {vehicles[0].model}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {vehicles[0].licensePlate}
                    </div>
                  </div>
                  <span className="text-[10px] tracking-widest text-slate-500">
                    {vehicles.length > 1 ? `+${vehicles.length - 1}` : ""}
                  </span>
                </div>
              )}
            </div>

            {/* ===== QUICK ACTIONS ===== */}
            <div className="bg-white/30 border border-[#1e2d44]/30 p-6 anim-fade-up delay-400 text-[#1e2d44] space-y-3">
              <div className="text-[10px] tracking-[0.4em] text-[#1e2d44]/70 mb-1 font-bold">
                QUICK LINKS
              </div>
              <Link to="/reservations" className="block bg-[#1e2d44] hover:bg-[#2a3b52] text-white text-xs font-black tracking-widest px-4 py-3 transition">
                MY RESERVATIONS →
              </Link>
            </div>
          </aside>
        </div>

      </main>

      {showBooking && selectedSlot && (
        <BookingModal
          slot={selectedSlot}
          vehicles={vehicles}
          rate={rate}
          userId={user.userId}
          onClose={() => setShowBooking(false)}
          onBooked={async () => {
            setShowBooking(false);
            await refreshSlots();
            setSelectedId(null);
          }}
        />
      )}

      {/* ========= FOOTER (dark spec strip) ========= */}
      <footer className="bg-[#16202f] border-t border-white/5 anim-fade-up delay-700">
        <div className="px-8 lg:px-14 py-5 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-10 lg:gap-14 flex-wrap">
            <FootStat label="ENGINE" value="MSSQL 2022" />
            <FootStat label="SLOTS" value={slots.length.toString()} />
            <FootStat label="LEVELS" value="03" />
            <FootStat label="SECTIONS" value="A · B · C" />
            <FootStat label="OPEN" value="08:00 – 20:00" />
          </div>
          <div className="text-[10px] tracking-[0.4em] text-slate-500">
            SMART PARKING SYSTEM
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ============ SUB-COMPONENTS ============ */

function HeroStat({ label, value }) {
  return (
    <div>
      <div className="text-[10px] tracking-[0.3em] text-slate-400 mb-1 font-bold">
        {label}
      </div>
      <div className="text-2xl font-black text-white tracking-tight">{value}</div>
    </div>
  );
}

function FootStat({ label, value }) {
  return (
    <div>
      <div className="text-[9px] tracking-[0.3em] text-slate-500 mb-0.5 font-bold">
        {label}
      </div>
      <div className="text-sm font-black text-white tracking-wide">{value}</div>
    </div>
  );
}

function SlotCell({ slot, isSelected, onClick }) {
  const Icon =
    slot.type === "Bike" ? BikeTopIcon : slot.type === "EV" ? EVTopIcon : CarTopIcon;

  if (slot.status === "Occupied") {
    return (
      <div className="relative aspect-square flex items-center justify-center bg-white/40 rounded-xl border border-[#1e2d44]/15 p-2">
        <Icon className="h-full max-h-[90%]" />
        <span className="absolute bottom-1 right-1.5 text-[9px] font-bold text-[#1e2d44]/60 tracking-wider">
          {slot.slotNumber}
        </span>
      </div>
    );
  }
  if (slot.status === "Maintenance") {
    return (
      <div className="relative aspect-square flex items-center justify-center bg-white/10 rounded-xl border border-dashed border-[#1e2d44]/30 text-[#1e2d44]/40">
        <span className="text-lg font-black">{slot.slotNumber}</span>
        <span className="absolute bottom-1 right-1.5 text-[8px] font-bold tracking-wider">
          M
        </span>
      </div>
    );
  }
  if (slot.status === "Reserved") {
    return (
      <div className="relative aspect-square flex items-center justify-center bg-[#cabf9e]/40 rounded-xl border border-[#1e2d44]/25 text-[#1e2d44]/70">
        <span className="text-lg font-black">{slot.slotNumber}</span>
        <span className="absolute bottom-1 right-1.5 text-[8px] font-bold tracking-wider">
          R
        </span>
      </div>
    );
  }
  return (
    <div
      onClick={onClick}
      className={`relative aspect-square flex items-center justify-center cursor-pointer rounded-xl border transition ${
        isSelected
          ? "bg-[#1e2d44] border-[#1e2d44] text-white shadow-lg scale-[1.02]"
          : "bg-white/15 border-[#1e2d44]/20 hover:bg-white/40 text-[#1e2d44]"
      }`}
    >
      <span className="text-lg font-black tracking-tight">{slot.slotNumber}</span>
    </div>
  );
}

function BikeTopIcon({ className = "" }) {
  // Royal Enfield Classic 350 — proper side profile
  const id = Math.random().toString(36).slice(2, 8);

  const wheel = (cx, cy, r, keyPrefix) => (
    <g key={keyPrefix}>
      {/* tire */}
      <circle cx={cx} cy={cy} r={r} fill="#0a0a0a" />
      <circle cx={cx} cy={cy} r={r - 2} fill="none" stroke="#1a1a1a" strokeWidth="1" />
      {/* rim */}
      <circle cx={cx} cy={cy} r={r - 6} fill="#cabf9e" opacity="0.15" />
      <circle cx={cx} cy={cy} r={r - 6} fill="none" stroke={`url(#chrome-${id})`} strokeWidth="2" />
      {/* spokes */}
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => {
        const rad = (a * Math.PI) / 180;
        return (
          <line
            key={`${keyPrefix}-${a}`}
            x1={cx + 4 * Math.cos(rad)}
            y1={cy + 4 * Math.sin(rad)}
            x2={cx + (r - 7) * Math.cos(rad)}
            y2={cy + (r - 7) * Math.sin(rad)}
            stroke="#888"
            strokeWidth="0.6"
          />
        );
      })}
      {/* hub */}
      <circle cx={cx} cy={cy} r="4" fill={`url(#chrome-${id})`} stroke="#444" strokeWidth="0.3" />
      <circle cx={cx} cy={cy} r="1.5" fill="#222" />
    </g>
  );

  return (
    <svg viewBox="0 0 240 150" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`tank-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a5f7e" />
          <stop offset="25%" stopColor="#2a3b5a" />
          <stop offset="100%" stopColor="#0a0f1e" />
        </linearGradient>
        <linearGradient id={`fender-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a3b52" />
          <stop offset="100%" stopColor="#060912" />
        </linearGradient>
        <linearGradient id={`chrome-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#d0d0d0" />
          <stop offset="100%" stopColor="#707070" />
        </linearGradient>
        <linearGradient id={`seat-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a2a2a" />
          <stop offset="100%" stopColor="#050505" />
        </linearGradient>
      </defs>

      {/* ground shadow */}
      <ellipse cx="120" cy="140" rx="95" ry="5" fill="#000" opacity="0.25" />

      {/* ========== WHEELS (drawn first, behind everything) ========== */}
      {wheel(55, 110, 27, "front")}
      {wheel(185, 110, 27, "rear")}

      {/* ========== FRONT FORK (tubes from wheel to headlight) ========== */}
      <line x1="55" y1="110" x2="58" y2="75" stroke="#888" strokeWidth="3" strokeLinecap="round" />
      <line x1="55" y1="110" x2="52" y2="75" stroke="#888" strokeWidth="3" strokeLinecap="round" />

      {/* ========== REAR SHOCK / STRUT ========== */}
      <line x1="185" y1="110" x2="165" y2="80" stroke="#555" strokeWidth="3" strokeLinecap="round" />

      {/* ========== FRAME TUBES ========== */}
      {/* top tube running under tank */}
      <line x1="70" y1="88" x2="155" y2="80" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round" />
      {/* down tube */}
      <line x1="70" y1="88" x2="100" y2="108" stroke="#1a1a1a" strokeWidth="3.5" strokeLinecap="round" />
      {/* seat tube */}
      <line x1="155" y1="80" x2="145" y2="108" stroke="#1a1a1a" strokeWidth="3.5" strokeLinecap="round" />
      {/* swing arm */}
      <line x1="145" y1="108" x2="185" y2="110" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" />

      {/* ========== EXHAUST PIPE ========== */}
      <path
        d="M 120 108
           C 140 112, 160 108, 180 105
           L 210 103
           Q 218 103, 218 108
           Q 218 112, 210 112
           L 180 114
           C 160 117, 140 116, 120 113 Z"
        fill={`url(#chrome-${id})`}
        stroke="#444"
        strokeWidth="0.6"
      />
      {/* exhaust heat shield */}
      <path
        d="M 170 106 L 208 104 L 208 110 L 170 112 Z"
        fill="#0a0a0a"
        opacity="0.7"
      />
      {/* exhaust tip */}
      <ellipse cx="218" cy="108" rx="3" ry="4" fill="#2a2a2a" stroke="#555" strokeWidth="0.5" />

      {/* ========== ENGINE BLOCK ========== */}
      {/* cylinder (upward) */}
      <rect x="98" y="72" width="22" height="36" rx="2" fill="#777" stroke="#333" strokeWidth="0.6" />
      {/* cooling fins */}
      {[76, 80, 84, 88, 92, 96, 100, 104].map((y) => (
        <line key={y} x1="96" y1={y} x2="122" y2={y} stroke="#222" strokeWidth="0.9" />
      ))}
      {/* crankcase (below cylinder) */}
      <ellipse cx="112" cy="112" rx="22" ry="10" fill="#444" stroke="#222" strokeWidth="0.5" />
      <circle cx="112" cy="112" r="5" fill="#222" />
      <circle cx="112" cy="112" r="2" fill="#777" />

      {/* ========== FUEL TANK (teardrop) ========== */}
      <path
        d="M 72 78
           Q 68 68, 76 60
           Q 92 52, 118 52
           L 148 52
           Q 156 54, 156 64
           Q 156 76, 150 82
           L 80 82
           Q 72 82, 72 78 Z"
        fill={`url(#tank-${id})`}
        stroke="#000"
        strokeWidth="0.8"
      />
      {/* tank highlight */}
      <path
        d="M 80 60 Q 100 55, 140 56"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.2"
        opacity="0.35"
      />
      {/* tank chrome stripe + badge */}
      <path
        d="M 82 72 Q 110 68, 150 70"
        fill="none"
        stroke={`url(#chrome-${id})`}
        strokeWidth="2"
      />
      <ellipse cx="115" cy="71" rx="9" ry="3" fill="#cabf9e" />
      <text x="115" y="73.5" textAnchor="middle" fontSize="3.5" fontWeight="900" fill="#1e2d44" letterSpacing="0.5">
        ROYAL
      </text>

      {/* tank cap */}
      <circle cx="110" cy="58" r="3" fill={`url(#chrome-${id})`} stroke="#444" strokeWidth="0.4" />

      {/* ========== SEAT ========== */}
      <path
        d="M 150 60
           Q 170 58, 192 62
           Q 200 64, 200 72
           Q 198 80, 188 82
           L 150 82
           Q 146 76, 150 60 Z"
        fill={`url(#seat-${id})`}
        stroke="#cabf9e"
        strokeWidth="0.5"
        strokeOpacity="0.25"
      />
      {/* seat stitching */}
      <path d="M 155 68 Q 175 66, 195 70" fill="none" stroke="#cabf9e" strokeWidth="0.4" strokeDasharray="2 1.5" opacity="0.4" />

      {/* ========== HEADLIGHT ========== */}
      <circle cx="55" cy="68" r="15" fill={`url(#chrome-${id})`} stroke="#555" strokeWidth="1" />
      <circle cx="55" cy="68" r="12" fill="#2a2a2a" />
      <circle cx="55" cy="68" r="10" fill="#fff8d0" />
      <circle cx="55" cy="68" r="7" fill="#ffffff" opacity="0.8" />
      <ellipse cx="50" cy="63" rx="2.5" ry="1.5" fill="#ffffff" />

      {/* headlight bracket connecting to fork */}
      <rect x="53" y="82" width="4" height="6" fill="#444" />

      {/* ========== HANDLEBARS ========== */}
      <path
        d="M 55 60 Q 45 48, 34 42"
        fill="none"
        stroke="#1a1a1a"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M 55 60 Q 64 55, 74 48"
        fill="none"
        stroke="#1a1a1a"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      {/* grips */}
      <rect x="30" y="39" width="8" height="7" rx="2.5" fill="#0a0a0a" stroke="#222" strokeWidth="0.4" />
      <rect x="72" y="45" width="8" height="7" rx="2.5" fill="#0a0a0a" stroke="#222" strokeWidth="0.4" />
      {/* mirrors */}
      <g>
        <line x1="34" y1="42" x2="24" y2="30" stroke="#666" strokeWidth="1.5" />
        <ellipse cx="22" cy="27" rx="5" ry="4" fill={`url(#chrome-${id})`} stroke="#444" strokeWidth="0.5" />
        <ellipse cx="22" cy="27" rx="3" ry="2.5" fill="#1a2d44" opacity="0.6" />
      </g>
      <g>
        <line x1="76" y1="48" x2="86" y2="34" stroke="#666" strokeWidth="1.5" />
        <ellipse cx="88" cy="30" rx="5" ry="4" fill={`url(#chrome-${id})`} stroke="#444" strokeWidth="0.5" />
        <ellipse cx="88" cy="30" rx="3" ry="2.5" fill="#1a2d44" opacity="0.6" />
      </g>

      {/* ========== FENDERS (drawn AFTER wheels, HUG the top arc) ========== */}
      {/* front fender */}
      <path
        d="M 32 98 Q 55 72, 78 98 L 76 104 Q 55 80, 34 104 Z"
        fill={`url(#fender-${id})`}
        stroke="#000"
        strokeWidth="0.4"
      />
      {/* rear fender — curves over rear wheel and extends back */}
      <path
        d="M 162 98 Q 185 72, 212 96 L 210 102 Q 185 80, 164 104 Z"
        fill={`url(#fender-${id})`}
        stroke="#000"
        strokeWidth="0.4"
      />

      {/* ========== TAIL LIGHT ========== */}
      <path
        d="M 208 86 L 216 84 L 216 96 L 210 96 Z"
        fill="#c94545"
        stroke="#6e1a1a"
        strokeWidth="0.5"
      />
      <rect x="210" y="87" width="5" height="3" rx="0.5" fill="#ff9090" opacity="0.9" />

      {/* license plate */}
      <rect x="202" y="97" width="14" height="9" rx="1" fill="#ffffff" stroke="#1a1a1a" strokeWidth="0.5" />
      <text x="209" y="103.5" textAnchor="middle" fontSize="4.5" fontWeight="900" fill="#1a1a1a">
        350
      </text>

      {/* foot pegs */}
      <circle cx="115" cy="120" r="2.5" fill="#555" stroke="#222" strokeWidth="0.4" />
      <circle cx="150" cy="118" r="2.5" fill="#555" stroke="#222" strokeWidth="0.4" />

      {/* kick-stand / side stand hint */}
      <line x1="95" y1="118" x2="85" y2="130" stroke="#222" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function EVTopIcon({ className = "" }) {
  // Tesla-style EV — sleek, no grille, glass roof
  const id = Math.random().toString(36).slice(2, 8);
  return (
    <svg viewBox="0 0 80 140" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`ev-paint-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7a0f18" />
          <stop offset="8%" stopColor="#a41626" />
          <stop offset="50%" stopColor="#d01e30" />
          <stop offset="92%" stopColor="#a41626" />
          <stop offset="100%" stopColor="#6a0d14" />
        </linearGradient>
        <linearGradient id={`ev-glass-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a1020" />
          <stop offset="100%" stopColor="#1e2d44" />
        </linearGradient>
        <linearGradient id={`ev-roof-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e2d44" stopOpacity="0.85" />
          <stop offset="50%" stopColor="#324865" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#1e2d44" stopOpacity="0.85" />
        </linearGradient>
      </defs>

      {/* shadow */}
      <ellipse cx="40" cy="134" rx="30" ry="3.5" fill="#000" opacity="0.22" />

      {/* sleek EV body — smoother, more aerodynamic */}
      <path
        d="M 16 24
           Q 16 8, 32 5
           L 48 5
           Q 64 8, 64 24
           L 66 56
           L 66 102
           Q 64 128, 52 132
           L 28 132
           Q 16 128, 14 102
           L 14 56
           Z"
        fill={`url(#ev-paint-${id})`}
        stroke="#4a0a14"
        strokeWidth="0.5"
      />

      {/* continuous glass roof — THE EV signature (one long glass from front to back) */}
      <path
        d="M 22 26
           Q 22 22, 28 22
           L 52 22
           Q 58 22, 58 26
           L 58 108
           Q 58 112, 52 112
           L 28 112
           Q 22 112, 22 108
           Z"
        fill={`url(#ev-roof-${id})`}
        stroke="#0a1020"
        strokeWidth="0.4"
      />

      {/* windshield edge highlight */}
      <path d="M 22 26 L 58 26 L 58 30 L 22 30 Z" fill="#ffffff" opacity="0.1" />

      {/* clean nose (no grille — EV feature) */}
      <path d="M 18 10 Q 40 6, 62 10" fill="none" stroke="#4a0a14" strokeWidth="0.6" opacity="0.6" />

      {/* slim headlight bars */}
      <rect x="20" y="8" width="14" height="2" rx="1" fill="#e8f5ff" />
      <rect x="46" y="8" width="14" height="2" rx="1" fill="#e8f5ff" />

      {/* charging port indicator on left rear */}
      <circle cx="12" cy="90" r="2" fill="#5dd39e" />
      <circle cx="12" cy="90" r="1" fill="#0a0f1e" />

      {/* sleek flush side mirrors */}
      <path d="M 12 32 L 16 36 L 18 34 L 15 30 Z" fill={`url(#ev-paint-${id})`} />
      <path d="M 68 32 L 64 36 L 62 34 L 65 30 Z" fill={`url(#ev-paint-${id})`} />

      {/* subtle door line */}
      <line x1="14" y1="68" x2="22" y2="68" stroke="#4a0a14" strokeWidth="0.4" opacity="0.6" />
      <line x1="58" y1="68" x2="66" y2="68" stroke="#4a0a14" strokeWidth="0.4" opacity="0.6" />

      {/* wheels */}
      <rect x="8" y="30" width="4" height="14" rx="1" fill="#0a0f1e" />
      <rect x="68" y="30" width="4" height="14" rx="1" fill="#0a0f1e" />
      <rect x="8" y="96" width="4" height="16" rx="1" fill="#0a0f1e" />
      <rect x="68" y="96" width="4" height="16" rx="1" fill="#0a0f1e" />

      {/* one-piece LED tail bar (EV signature) */}
      <rect x="22" y="125" width="36" height="2.5" rx="1.25" fill="#c94545" />
      <rect x="22" y="125" width="36" height="1" rx="0.5" fill="#ff7a7a" opacity="0.8" />

      {/* EV bolt emblem on glass roof */}
      <path
        d="M 42 62 L 36 76 L 40 76 L 38 86 L 44 72 L 40 72 Z"
        fill="#5dd39e"
        stroke="#1a4d3a"
        strokeWidth="0.3"
      />
    </svg>
  );
}

function CarTopIcon({ className = "" }) {
  const id = Math.random().toString(36).slice(2, 8);
  return (
    <svg viewBox="0 0 80 140" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`paint-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#14203a" />
          <stop offset="8%" stopColor="#1e2d44" />
          <stop offset="50%" stopColor="#2a3e5e" />
          <stop offset="92%" stopColor="#1e2d44" />
          <stop offset="100%" stopColor="#101a30" />
        </linearGradient>
        <linearGradient id={`glass-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0f1a2d" />
          <stop offset="100%" stopColor="#1e2d44" />
        </linearGradient>
      </defs>

      {/* ground shadow */}
      <ellipse cx="40" cy="134" rx="30" ry="3.5" fill="#000" opacity="0.22" />

      {/* muscle car body - wide and long */}
      <path
        d="M 16 22
           Q 16 8, 28 5
           L 52 5
           Q 64 8, 64 22
           L 66 55
           L 67 100
           Q 65 130, 55 133
           L 25 133
           Q 15 130, 14 100
           L 13 55
           Z"
        fill={`url(#paint-${id})`}
        stroke="#0a0f1e"
        strokeWidth="0.5"
      />

      {/* racing stripes — cream down the center */}
      <rect x="33" y="8" width="4.5" height="122" fill="#e6dcc2" />
      <rect x="42.5" y="8" width="4.5" height="122" fill="#e6dcc2" />

      {/* front bumper seam */}
      <path d="M 18 16 Q 40 12, 62 16" fill="none" stroke="#0a0f1e" strokeWidth="0.6" opacity="0.6" />

      {/* headlights */}
      <rect x="18" y="7" width="10" height="3" rx="1.5" fill="#fff5d6" />
      <rect x="52" y="7" width="10" height="3" rx="1.5" fill="#fff5d6" />

      {/* grille */}
      <rect x="30" y="8" width="20" height="4" fill="#1a1a1a" opacity="0.85" />

      {/* windshield — angled */}
      <path d="M 22 30 L 58 30 Q 60 42, 60 54 L 20 54 Q 20 42, 22 30 Z" fill={`url(#glass-${id})`} />
      {/* windshield highlight */}
      <path d="M 22 30 L 58 30 Q 59 35, 59 40 L 21 40 Q 21 35, 22 30 Z" fill="#fff" opacity="0.15" />

      {/* roof (stripes continue over it) */}
      {/* rear window */}
      <path d="M 22 100 L 58 100 Q 60 88, 60 76 L 20 76 Q 20 88, 22 100 Z" fill={`url(#glass-${id})`} />

      {/* side mirrors — angular */}
      <path d="M 11 30 L 14 36 L 16 35 L 15 29 Z" fill={`url(#paint-${id})`} stroke="#0a0f1e" strokeWidth="0.4" />
      <path d="M 69 30 L 66 36 L 64 35 L 65 29 Z" fill={`url(#paint-${id})`} stroke="#0a0f1e" strokeWidth="0.4" />

      {/* door seam */}
      <line x1="14" y1="65" x2="19" y2="65" stroke="#0a0f1e" strokeWidth="0.5" opacity="0.6" />
      <line x1="61" y1="65" x2="66" y2="65" stroke="#0a0f1e" strokeWidth="0.5" opacity="0.6" />

      {/* wheel wells visible at corners */}
      <rect x="8" y="25" width="4" height="13" rx="1" fill="#0a0f1e" />
      <rect x="68" y="25" width="4" height="13" rx="1" fill="#0a0f1e" />
      <rect x="8" y="98" width="4" height="15" rx="1" fill="#0a0f1e" />
      <rect x="68" y="98" width="4" height="15" rx="1" fill="#0a0f1e" />

      {/* rear lights */}
      <rect x="18" y="126" width="11" height="3" rx="1.5" fill="#c94545" />
      <rect x="51" y="126" width="11" height="3" rx="1.5" fill="#c94545" />

      {/* trunk seam */}
      <path d="M 18 123 Q 40 127, 62 123" fill="none" stroke="#0a0f1e" strokeWidth="0.5" opacity="0.5" />

      {/* tiny GT badge on hood */}
      <rect x="36" y="20" width="8" height="2" rx="0.5" fill="#1e3a5f" opacity="0.8" />
    </svg>
  );
}

function Line({ label, value, bold }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400 text-xs tracking-wider uppercase">{label}</span>
      <span className={bold ? "text-white font-black text-lg" : "text-white font-semibold"}>
        {value}
      </span>
    </div>
  );
}

function Line2({ label, value, bold, mono }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#1e2d44]/70 text-xs tracking-wider uppercase">{label}</span>
      <span
        className={`${bold ? "font-black text-lg" : "font-semibold"} ${
          mono ? "font-mono tracking-wider" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Pill({ children }) {
  return (
    <span className="bg-white/10 border border-white/15 rounded px-2 py-0.5 text-[11px] font-bold tracking-wide">
      {children}
    </span>
  );
}

function FacilityMap({ selected }) {
  // Top-down parking lot: Sections A (18 slots, 3 cols x 6), B (Basement), C (Second Floor)
  // Selected slot in Section A is highlighted coral
  const slotIndex = parseInt(selected, 10) - 1;
  const col = slotIndex % 3;
  const row = Math.floor(slotIndex / 3);

  return (
    <svg viewBox="0 0 360 200" className="w-full h-44">
      {/* ground outline */}
      <rect x="4" y="4" width="352" height="192" fill="none" stroke="#cabf9e" strokeOpacity="0.25" strokeDasharray="3 3" />

      {/* Section A label */}
      <text x="12" y="22" fill="#cabf9e" fontSize="9" fontWeight="900" letterSpacing="2">
        SECTION A · GROUND
      </text>

      {/* Entrance arrow */}
      <text x="175" y="194" fill="#cabf9e" fontSize="8" letterSpacing="2" opacity="0.6">
        ENTRANCE ↑
      </text>

      {/* Section A grid: 3 cols x 6 rows at left */}
      {[...Array(18)].map((_, i) => {
        const c = i % 3;
        const r = Math.floor(i / 3);
        const x = 14 + c * 38;
        const y = 32 + r * 24;
        const isSel = i === slotIndex;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width="34"
              height="20"
              fill={isSel ? "#e85d5d" : "#2a3b52"}
              stroke={isSel ? "#ffb3b3" : "#3b506e"}
              strokeWidth={isSel ? "2" : "1"}
            />
            <text
              x={x + 17}
              y={y + 14}
              textAnchor="middle"
              fill={isSel ? "white" : "#cabf9e"}
              fontSize="9"
              fontWeight="900"
              opacity={isSel ? 1 : 0.7}
            >
              {String(i + 1).padStart(2, "0")}
            </text>
          </g>
        );
      })}

      {/* Lane between A and B */}
      <line x1="140" y1="30" x2="140" y2="176" stroke="#cabf9e" strokeOpacity="0.15" strokeDasharray="4 4" />

      {/* Section B (Basement / Bike) */}
      <text x="156" y="22" fill="#cabf9e" fontSize="9" fontWeight="900" letterSpacing="2">
        B · BIKE
      </text>
      {[...Array(6)].map((_, i) => (
        <rect
          key={i}
          x={156}
          y={32 + i * 24}
          width="60"
          height="20"
          fill="#2a3b52"
          stroke="#3b506e"
        />
      ))}

      {/* Section C (EV) */}
      <text x="232" y="22" fill="#cabf9e" fontSize="9" fontWeight="900" letterSpacing="2">
        C · EV
      </text>
      {[...Array(6)].map((_, i) => (
        <rect
          key={i}
          x={232}
          y={32 + i * 24}
          width="60"
          height="20"
          fill="#2a3b52"
          stroke="#3b506e"
        />
      ))}

      {/* Route line from entrance to selected slot */}
      {(() => {
        const sx = 180;
        const sy = 180;
        const tx = 14 + col * 38 + 17;
        const ty = 32 + row * 24 + 10;
        const midY = 170;
        return (
          <g>
            <path
              d={`M ${sx} ${sy} L ${sx} ${midY} L ${tx} ${midY} L ${tx} ${ty}`}
              fill="none"
              stroke="#e85d5d"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            <circle cx={sx} cy={sy} r="3" fill="#cabf9e" />
            <circle cx={tx} cy={ty} r="3" fill="#e85d5d" />
          </g>
        );
      })()}

      {/* You are here label */}
      <text x="184" y="178" fill="#cabf9e" fontSize="7" letterSpacing="1" opacity="0.7">
        YOU
      </text>

      {/* Elevators / exit symbols */}
      <rect x="310" y="32" width="38" height="20" fill="none" stroke="#cabf9e" strokeOpacity="0.3" />
      <text x="329" y="46" textAnchor="middle" fill="#cabf9e" fontSize="8" fontWeight="700" opacity="0.6">
        LIFT
      </text>
      <rect x="310" y="56" width="38" height="20" fill="none" stroke="#cabf9e" strokeOpacity="0.3" />
      <text x="329" y="70" textAnchor="middle" fill="#cabf9e" fontSize="8" fontWeight="700" opacity="0.6">
        EXIT
      </text>
    </svg>
  );
}

function Row({ slot, vehicle, start, end, status, amount }) {
  return (
    <tr className="border-t border-[#1e2d44]/15">
      <td className="px-5 py-4 font-black">{slot}</td>
      <td className="px-5 py-4 font-mono text-xs tracking-wider">{vehicle}</td>
      <td className="px-5 py-4 text-sm">{start}</td>
      <td className="px-5 py-4 text-sm">{end}</td>
      <td className="px-5 py-4">
        <span className="text-[10px] tracking-[0.2em] font-bold bg-[#1e2d44] text-white px-2 py-1">
          {status}
        </span>
      </td>
      <td className="px-5 py-4 text-right font-black">{amount}</td>
    </tr>
  );
}
