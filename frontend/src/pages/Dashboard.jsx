import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, getSession } from "../api";
import Shell, { Hero, HeroStat, Cream, Badge, ErrorBox } from "../components/Shell";
import BookingModal from "../components/BookingModal";

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
    if (!user) { navigate("/login"); return; }
    if (user.role === "Admin") { navigate("/admin"); return; }
    (async () => {
      try {
        const [ss, ls, pr, vs] = await Promise.all([
          api.slots(), api.locations(), api.pricing(), api.myVehicles(user.userId),
        ]);
        setSlots(ss); setLocations(ls); setPricing(pr); setVehicles(vs);
        if (ls.length > 0) setLocation(ls[0]);
      } catch (e) { setErr(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  const refresh = async () => {
    try { setSlots(await api.slots()); } catch (e) { setErr(e.message); }
  };

  // Tick every 30s so "free in Xm" countdowns stay accurate
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  if (!user) return null;

  const inLocation = slots.filter((s) => s.location === location);
  const selected = slots.find((s) => s.slotId === selectedId);
  const priceFor = (type) => {
    const p = pricing.find((x) => x.type === type);
    return p ? Number(p.pricePerHour) : 0;
  };
  const rate = selected ? priceFor(selected.type) : 0;

  const counts = {
    available: slots.filter((s) => s.status === "Available").length,
    occupied:  slots.filter((s) => s.status === "Occupied").length,
    reserved:  slots.filter((s) => s.status === "Reserved").length,
  };

  // Soonest-to-free slot in the current location (excluding Available)
  const nextFreeUp = inLocation
    .filter((s) => s.freeAt && s.status !== "Available")
    .sort((a, b) => new Date(a.freeAt) - new Date(b.freeAt))[0] || null;

  // Per-location breakdown (used in sidebar card)
  const byLocation = locations.map((loc) => {
    const inLoc = slots.filter((s) => s.location === loc);
    const avail = inLoc.filter((s) => s.status === "Available").length;
    return { loc, total: inLoc.length, avail, full: inLoc.length > 0 && avail === 0 };
  });

  // Per-type availability
  const byType = ["Car", "Bike", "EBike", "EV"].map((t) => ({
    type: t,
    avail: slots.filter((s) => s.type === t && s.status === "Available").length,
    total: slots.filter((s) => s.type === t).length,
  }));

  // Lot occupancy %
  const occupancyPct = counts.total === 0
    ? 0
    : Math.round(((slots.length - counts.available) / slots.length) * 100);

  // Peak hours: 08-11 and 17-20
  const hour = new Date().getHours();
  const isPeak = (hour >= 8 && hour < 11) || (hour >= 17 && hour < 20);
  const isOpen = hour >= 8 && hour < 20;

  // Selected-slot context (neighbour availability + spot dimensions)
  const selectedNeighbours = (() => {
    if (!selected) return null;
    const sameRow = slots.filter((s) => s.location === selected.location);
    const idx = sameRow.findIndex((s) => s.slotId === selected.slotId);
    const left = sameRow[idx - 1];
    const right = sameRow[idx + 1];
    return {
      left: left ? left.status : null,
      right: right ? right.status : null,
      neighbourAvail: [left, right].filter((s) => s && s.status === "Available").length,
    };
  })();
  const slotDims = selected
    ? selected.type === "Bike" || selected.type === "EBike"
        ? "2.5 m × 1.0 m"
        : selected.type === "EV"
            ? "5.0 m × 2.7 m · charger"
            : "5.0 m × 2.5 m"
    : "—";

  return (
    <Shell>
      <Hero
        kicker={selected
          ? `NO. ${selected.slotNumber} · ${selected.location.toUpperCase()} · ${selected.type.toUpperCase()}`
          : "SELECT A SLOT"}
        title={selected ? `SLOT ${selected.slotNumber}` : "PICK A SLOT"}
        subtitle={
          selected
            ? "Selected spot. Review your booking below, then confirm."
            : nextFreeUp
              ? `Slot ${nextFreeUp.slotNumber} (${nextFreeUp.status.toLowerCase()}) frees up in ${fmtFreeIn(nextFreeUp.freeAt)} — at ${fmtFreeAt(nextFreeUp.freeAt)}.`
              : "Click any available slot from the floor plan below."
        }
      >
        <HeroStat label="AVAILABLE" value={counts.available} />
        <HeroStat label="RESERVED" value={counts.reserved} />
        <HeroStat label="OCCUPIED" value={counts.occupied} />
        <HeroStat label="LOAD" value={`${occupancyPct}%`} />
        {nextFreeUp ? (
          <HeroStat label="↻ NEXT FREE" value={fmtFreeIn(nextFreeUp.freeAt)} />
        ) : (
          <HeroStat label="RATE" value={selected ? `Rs ${rate}/h` : "—"} />
        )}
      </Hero>

      <Cream>
        <ErrorBox msg={err} onLight />

        {/* ============= STATUS STRIP ============= */}
        <div className="bg-[#1e2d44] text-white px-6 py-4 mb-8 flex flex-wrap items-center justify-between gap-4 anim-fade-up">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`flex items-center gap-2 text-[10px] tracking-[0.3em] font-bold px-3 py-1.5 ${
              isOpen ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? "bg-emerald-400 pulse-dot" : "bg-red-400"}`} />
              {isOpen ? "OPEN" : "CLOSED"}
            </span>
            {isOpen && (
              <span className={`text-[10px] tracking-[0.3em] font-bold px-3 py-1.5 ${
                isPeak ? "bg-amber-500/20 text-amber-300" : "bg-white/10 text-slate-300"
              }`}>
                {isPeak ? "★ PEAK HOURS" : "OFF-PEAK"}
              </span>
            )}
            <span className="text-[10px] tracking-[0.3em] text-slate-400 font-bold">
              MON – SAT · 08:00 – 20:00
            </span>
          </div>
          <div className="flex items-center gap-6 flex-wrap">
            {byType.map((t) => (
              <div key={t.type} className="flex items-baseline gap-2">
                <span className="text-[10px] tracking-[0.3em] text-slate-400 font-bold">{t.type.toUpperCase()}S</span>
                <span className="font-black text-lg">{t.avail}</span>
                <span className="text-[10px] text-slate-500">/ {t.total}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-10">
          <section className="lg:col-span-8 anim-fade-up delay-200">
            <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
              <div>
                <div className="text-[10px] tracking-[0.4em] text-[#1e2d44]/60 mb-1 font-bold">LIVE VIEW</div>
                <h2 className="text-3xl font-black tracking-tight">Parking Floor Plan</h2>
                <p className="text-xs text-[#1e2d44]/60 mt-1 font-mono">
                  {location.toUpperCase()} · {inLocation.filter((s) => s.status === "Available").length}/{inLocation.length} AVAILABLE
                </p>
              </div>
              <Legend />
            </div>

            <div className="flex gap-2 mb-5 flex-wrap">
              {locations.map((loc) => (
                <button
                  key={loc}
                  onClick={() => { setLocation(loc); setSelectedId(null); }}
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

            <div className="bg-[#1e2d44] rounded-2xl p-5 border border-[#1e2d44]/10 min-h-[200px]">
              {loading ? (
                <div className="text-center py-12 text-white/50 text-sm tracking-widest">LOADING SLOTS…</div>
              ) : inLocation.length === 0 ? (
                <div className="text-center py-12 text-white/50 text-sm tracking-widest">
                  NO SLOTS AT {location.toUpperCase()}
                </div>
              ) : (
                <FloorPlan slots={inLocation} location={location} selectedId={selectedId} onSelect={setSelectedId} />
              )}
            </div>

            <button
              onClick={() => selected && setShowBooking(true)}
              disabled={!selected || selected.status !== "Available"}
              className="mt-6 w-full bg-[#1e2d44] hover:bg-[#2a3b52] disabled:opacity-40 disabled:cursor-not-allowed text-white font-black tracking-[0.3em] py-4 shadow-xl transition"
            >
              {selected ? `PARK AT SLOT ${selected.slotNumber} →` : "SELECT A SLOT"}
            </button>
          </section>

          <aside className="lg:col-span-4 space-y-6">
            <div className="bg-[#1e2d44] text-white anim-fade-up delay-300">
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <Pill>{selected?.location || location || "—"}</Pill>
                  <Pill>№ {selected?.slotNumber || "—"}</Pill>
                  <Pill>{selected?.type || "—"}</Pill>
                </div>
                <h3 className="text-2xl font-black leading-tight mb-1">FAST-NUCES Main Parking</h3>
                <p className="text-xs text-slate-400 tracking-wide mb-4">
                  Rs {selected ? priceFor(selected.type) : "—"} / hour · Mon–Sat · 08:00 – 20:00
                </p>

                {selected && (
                  <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                    <Spec k="DIMENSIONS" v={slotDims} />
                    <Spec k="ADJACENT FREE" v={`${selectedNeighbours.neighbourAvail} / 2`} />
                    <Spec k="SECTION" v={selected.slotNumber.replace(/[0-9]/g, "") || "—"} />
                    <Spec k="STATUS" v={selected.status.toUpperCase()} />
                    {selected.freeAt && selected.status !== "Available" && (
                      <Spec k="↻ FREE IN" v={fmtFreeIn(selected.freeAt)} />
                    )}
                    {selected.freeAt && selected.status !== "Available" && (
                      <Spec k="↻ AT" v={fmtFreeAt(selected.freeAt)} />
                    )}
                  </div>
                )}

                <button
                  onClick={() => selected && setShowBooking(true)}
                  disabled={!selected || selected.status !== "Available"}
                  className="btn-sweep w-full bg-[#cabf9e] hover:bg-[#b6a880] disabled:opacity-40 disabled:cursor-not-allowed text-[#1e2d44] font-black tracking-[0.25em] py-3 transition"
                >
                  START PARKING
                </button>
              </div>
              {vehicles.length > 0 && (
                <div className="px-5 py-4 border-t border-white/10 bg-[#16202f]">
                  <div className="text-[10px] tracking-[0.3em] text-slate-500 font-bold mb-1">MY VEHICLE</div>
                  <div className="text-sm font-black leading-tight">
                    {vehicles[0].brand} {vehicles[0].model}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">{vehicles[0].licensePlate}</div>
                  {vehicles.length > 1 && (
                    <div className="text-[10px] tracking-widest text-slate-500 mt-1">+{vehicles.length - 1} more</div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white/30 border border-[#1e2d44]/30 p-6 anim-fade-up delay-400 text-[#1e2d44] space-y-3">
              <div className="text-[10px] tracking-[0.4em] text-[#1e2d44]/70 mb-1 font-bold">QUICK LINKS</div>
              <Link to="/reservations" className="block bg-[#1e2d44] hover:bg-[#2a3b52] text-white text-xs font-black tracking-widest px-4 py-3 transition text-center">
                MY RESERVATIONS →
              </Link>
              <Link to="/vehicles" className="block bg-white/40 hover:bg-white/60 text-[#1e2d44] text-xs font-black tracking-widest px-4 py-3 transition text-center border border-[#1e2d44]/15">
                MY VEHICLES →
              </Link>
            </div>

            <div className="bg-white/20 border border-[#1e2d44]/15 p-5">
              <div className="text-[10px] tracking-[0.4em] text-[#1e2d44]/70 mb-3 font-bold">PRICING</div>
              <div className="space-y-2 text-sm">
                {pricing.map((p) => (
                  <div key={p.type} className="flex justify-between">
                    <span className="text-[#1e2d44]/70">{p.type}</span>
                    <span className="font-black">Rs {Number(p.pricePerHour).toFixed(0)}/hr</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </Cream>

      {showBooking && selected && (
        <BookingModal
          slot={selected}
          vehicles={vehicles}
          rate={rate}
          userId={user.userId}
          onClose={() => setShowBooking(false)}
          onBooked={async () => { setShowBooking(false); await refresh(); setSelectedId(null); }}
        />
      )}
    </Shell>
  );
}

/* ─────────────── Floor Plan (SVG architectural sketch) ─────────────── */
// Row capacity: dynamically scales from MIN_PER_ROW (5) to MAX_PER_ROW (30).
// The lot width is fixed; slot box width scales down as you pack more in.
const MIN_PER_ROW = 5;
const MAX_PER_ROW = 30;
const LOT_W = 1100;     // fixed total width
const SH = 116;         // slot height
const SGAP = 6;         // slot gap
const LANE = 60;        // drive lane height
const PAD = 44;         // wall to first slot
const BAY_GAP = 32;     // separator between bays
const GATE_H = 90;      // bottom strip for gates (room for label + arrow + opening)

function FloorPlan({ slots, location, selectedId, onSelect }) {
  // Group slots into rows by their LaneID. Each lane = one visual row.
  // Slots with no laneId share a single "default" row, sorted by slotNumber.
  const sorted = [...slots].sort((a, b) =>
    a.slotNumber.localeCompare(b.slotNumber, undefined, { numeric: true })
  );

  const laneMap = new Map();
  for (const s of sorted) {
    const key = s.laneId == null ? "_default" : s.laneId;
    if (!laneMap.has(key)) laneMap.set(key, []);
    laneMap.get(key).push(s);
  }
  // Order lanes by smallest slotNumber within each
  const lanes = Array.from(laneMap.values()).sort((a, b) =>
    a[0].slotNumber.localeCompare(b[0].slotNumber, undefined, { numeric: true })
  );

  // Row capacity from the largest lane (caps at MAX_PER_ROW)
  const maxLaneSize = Math.max(MIN_PER_ROW, ...lanes.map((l) => l.length));
  const rowCapacity = Math.min(MAX_PER_ROW, maxLaneSize);

  // If a lane exceeds MAX_PER_ROW, split it into multiple rows (still grouped together)
  const rows = [];
  for (const lane of lanes) {
    for (let i = 0; i < lane.length; i += rowCapacity) {
      rows.push(lane.slice(i, i + rowCapacity));
    }
  }
  if (rows.length === 0) rows.push([]);

  // One bay per lane row. Drive lanes appear between consecutive bays
  // (rendered after every bay except the last).
  const bays = rows.map((row) => ({ top: row, bottom: [] }));

  // Lot dimensions — fixed width, slot width derives from rowCapacity
  const lotW = LOT_W;
  const SW = (lotW - PAD * 2 - (rowCapacity - 1) * SGAP) / rowCapacity;
  const interiorH = bays.length * SH + Math.max(0, bays.length - 1) * LANE;
  const lotH = PAD + interiorH + GATE_H;

  // Compute (x,y) for every slot. Single-row bays separated by drive lanes.
  // Alternate flip direction so neighbouring bays face the lane between them.
  const placed = [];
  let cursorY = PAD;
  bays.forEach((bay, bIdx) => {
    const flip = bIdx % 2 === 1; // odd-indexed bays face up (curb at bottom)
    bay.top.forEach((s, c) => {
      placed.push({
        ...s,
        x: PAD + c * (SW + SGAP), y: cursorY, w: SW, flip,
        bayIdx: bIdx,
        isLastInRow: c === bay.top.length - 1,
      });
    });
    cursorY += SH;
    if (bIdx < bays.length - 1) cursorY += LANE;
  });

  // Gate positions (carved into bottom wall)
  const entranceX = PAD;
  const entranceW = 70;
  const exitX = lotW - PAD - 70;
  const exitW = 70;
  const wallY = lotH - GATE_H + 10;

  // Find nearest available slot to the entrance (best pick)
  const entranceCenter = { x: entranceX + entranceW / 2, y: wallY };
  let nearest = null;
  for (const s of placed) {
    if (s.status !== "Available") continue;
    const cx = s.x + SW / 2, cy = s.y + SH / 2;
    const d = Math.hypot(cx - entranceCenter.x, cy - entranceCenter.y);
    if (!nearest || d < nearest.d) nearest = { ...s, d };
  }

  // Section watermark letter
  const sectionLetter = (location?.[0] || "P").toUpperCase();

  return (
    <div className="overflow-x-auto">
      <div className="text-[10px] tracking-[0.3em] text-white/40 mb-3 text-center font-bold">
        FLOOR PLAN · {location?.toUpperCase() || ""} · TOP-DOWN
      </div>

      <svg
        viewBox={`0 0 ${lotW} ${lotH}`}
        className="w-full h-auto"
        style={{ minWidth: 600 }}
      >
        <defs>
          <pattern id="concrete" width="14" height="14" patternUnits="userSpaceOnUse">
            <rect width="14" height="14" fill="#0d1525" />
            <circle cx="2" cy="2" r="0.6" fill="rgba(255,255,255,0.04)" />
            <circle cx="9" cy="7" r="0.5" fill="rgba(255,255,255,0.03)" />
          </pattern>
          <marker id="laneArrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#facc15" opacity="0.6" />
          </marker>
        </defs>

        {/* floor */}
        <rect x="0" y="0" width={lotW} height={lotH} fill="url(#concrete)" rx="10" />

        {/* huge section letter watermark */}
        <text
          x={lotW / 2}
          y={(lotH - GATE_H) / 2 + 70}
          textAnchor="middle"
          fontSize="220"
          fontWeight="900"
          fill="white"
          opacity="0.035"
          style={{ letterSpacing: "20px" }}
        >
          {sectionLetter}
        </text>

        {/* outer wall */}
        <rect
          x="6" y="6"
          width={lotW - 12} height={lotH - 12}
          fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="3" rx="8"
        />
        {/* inner wall — wraps ONLY the slot area (above the gate band) */}
        <rect
          x="11" y="11"
          width={lotW - 22} height={lotH - GATE_H - 6}
          fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" rx="6"
        />
        {/* gate band background — clearly distinguished from slot floor */}
        <rect
          x="11" y={lotH - GATE_H + 6}
          width={lotW - 22} height={GATE_H - 17}
          fill="rgba(0,0,0,0.18)"
          stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" strokeDasharray="2 3"
          rx="3"
        />

        {/* corner pillars (top corners only — bottom corners reserved for gates) */}
        {[[18,18],[lotW-30,18]].map(([x,y],i) => (
          <rect key={i} x={x} y={y} width="12" height="12" fill="#1e2d44" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
        ))}

        {/* DRIVE LANES + flow arrows — one between every pair of consecutive bays */}
        {(() => {
          const lanes = [];
          let cy = PAD + SH; // bottom edge of first bay
          for (let bIdx = 0; bIdx < bays.length - 1; bIdx++) {
            const laneY = cy + LANE / 2;
            lanes.push(
              <g key={`lane-${bIdx}`}>
                <rect x={PAD - 6} y={cy} width={lotW - 2*PAD + 12} height={LANE} fill="rgba(0,0,0,0.18)" />
                <line
                  x1={PAD} y1={laneY} x2={lotW - PAD} y2={laneY}
                  stroke="#facc15" strokeWidth="1.5" strokeDasharray="14 10" opacity="0.6"
                />
                <line
                  x1={PAD + 30} y1={laneY - 14}
                  x2={lotW - PAD - 30} y2={laneY - 14}
                  stroke="#facc15" strokeWidth="1.2" opacity="0.55"
                  markerEnd="url(#laneArrow)"
                />
                <text x={lotW / 2} y={laneY + 18} textAnchor="middle" fill="white" opacity="0.35" fontSize="9" fontWeight="700" letterSpacing="3">
                  DRIVE LANE
                </text>
              </g>
            );
            cy += LANE + SH;
          }
          return lanes;
        })()}

        {/* mid pillars between adjacent slots (skip last-in-row to avoid stray pillars) */}
        {placed.map((s, i) => {
          if (s.isLastInRow) return null;
          if ((i % 2) !== 1) return null;
          return (
            <rect
              key={`pillar-${s.slotId}`}
              x={s.x + SW + 1} y={s.y + SH / 2 - 5}
              width="4" height="10"
              fill="#1e2d44" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5"
            />
          );
        })}

        {/* SLOTS */}
        {placed.map((s) => (
          <SlotShape
            key={s.slotId}
            slot={s}
            selected={s.slotId === selectedId}
            isNearest={nearest && s.slotId === nearest.slotId}
            onSelect={onSelect}
          />
        ))}

        {/* All gate elements live INSIDE the bottom wall band, fully bounded */}
        {(() => {
          const labelY  = lotH - GATE_H + 22;   // labels (top of band)
          const arrowY  = lotH - GATE_H + 38;   // arrow tip / base
          const arrowB  = lotH - GATE_H + 60;   // arrow base / tip
          const openingY = lotH - 14;           // wall opening rect y (above outer wall)
          return (
            <g>
              {/* ENTRANCE label + arrow + wall opening */}
              <text x={entranceX + entranceW/2} y={labelY} textAnchor="middle" fill="#10b981" fontSize="9" fontWeight="900" letterSpacing="2">
                ENTRANCE
              </text>
              <polygon
                points={`${entranceX + entranceW/2 - 11},${arrowB} ${entranceX + entranceW/2 + 11},${arrowB} ${entranceX + entranceW/2},${arrowY}`}
                fill="#10b981"
              />
              {/* opening — sits within outer wall stroke */}
              <rect x={entranceX} y={openingY} width={entranceW} height="6" fill="#0d1525" />

              {/* EXIT label + arrow + wall opening */}
              <text x={exitX + exitW/2} y={labelY} textAnchor="middle" fill="#f59e0b" fontSize="9" fontWeight="900" letterSpacing="2">
                EXIT
              </text>
              <polygon
                points={`${exitX + exitW/2 - 11},${arrowY} ${exitX + exitW/2 + 11},${arrowY} ${exitX + exitW/2},${arrowB}`}
                fill="#f59e0b"
              />
              <rect x={exitX} y={openingY} width={exitW} height="6" fill="#0d1525" />

              {/* RAMP — interior, between gates, fully inside lot */}
              <rect
                x={lotW/2 - 30} y={arrowY - 6}
                width="60" height="22"
                fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1"
                strokeDasharray="3 3" rx="2"
              />
              <text x={lotW/2} y={arrowY + 8} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="8" fontWeight="900" letterSpacing="2">
                RAMP ↕
              </text>
            </g>
          );
        })()}

      </svg>
    </div>
  );
}

function SlotShape({ slot, selected, isNearest, onSelect }) {
  const SW = slot.w;     // slot width comes from FloorPlan layout (dynamic)
  const isAvail = slot.status === "Available";
  const fontMain = SW < 50 ? 14 : SW < 70 ? 18 : 22;
  const fontSub = SW < 50 ? 7 : 9;
  const colors = {
    Available:   { fill: "rgba(255,255,255,0.06)", stroke: "rgba(255,255,255,0.45)", text: "white" },
    Reserved:    { fill: "rgba(56,189,248,0.16)",  stroke: "rgba(56,189,248,0.55)", text: "#7dd3fc" },
    Occupied:    { fill: "#16202f",                stroke: "rgba(255,255,255,0.15)", text: "rgba(255,255,255,0.4)" },
    Maintenance: { fill: "rgba(239,68,68,0.10)",   stroke: "rgba(239,68,68,0.4)",    text: "#fca5a5" },
  };
  const c = colors[slot.status] || colors.Available;

  const fill   = selected ? "#cabf9e" : c.fill;
  const stroke = selected ? "#cabf9e" : c.stroke;
  const text   = selected ? "#1e2d44" : c.text;

  return (
    <g
      onClick={() => isAvail && onSelect(slot.slotId)}
      style={{ cursor: isAvail ? "pointer" : "not-allowed" }}
    >
      <rect
        x={slot.x} y={slot.y}
        width={SW} height={SH}
        fill={fill} stroke={stroke}
        strokeWidth={selected ? 2.5 : 1.5}
        rx="4"
      />
      {slot.status === "Maintenance" && (
        <rect x={slot.x} y={slot.y} width={SW} height={SH} fill="url(#hatch)" rx="4" />
      )}
      <line
        x1={slot.x + 10} x2={slot.x + SW - 10}
        y1={slot.flip ? slot.y + SH - 8 : slot.y + 8}
        y2={slot.flip ? slot.y + SH - 8 : slot.y + 8}
        stroke={text} strokeOpacity="0.4" strokeWidth="2.5" strokeLinecap="round"
      />
      <line x1={slot.x} y1={slot.y + 4} x2={slot.x} y2={slot.y + SH - 4} stroke={stroke} strokeWidth="0.5" />
      <line x1={slot.x + SW} y1={slot.y + 4} x2={slot.x + SW} y2={slot.y + SH - 4} stroke={stroke} strokeWidth="0.5" />

      <text
        x={slot.x + SW/2}
        y={slot.y + SH/2 + 2}
        textAnchor="middle"
        fill={text}
        fontSize={fontMain}
        fontWeight="900"
      >
        {slot.slotNumber}
      </text>
      <text
        x={slot.x + SW/2}
        y={slot.y + SH/2 + fontMain + 4}
        textAnchor="middle"
        fill={text}
        fontSize={fontSub}
        fontWeight="700"
        opacity="0.65"
        letterSpacing={SW < 50 ? 1 : 2}
      >
        {slot.type === "Bike" ? "BIKE" : slot.type === "EBike" ? "E-BIKE" : slot.type === "EV" ? "EV" : "CAR"}
      </text>

      {slot.freeAt && !isAvail && slot.status !== "Maintenance" && (
        <>
          <text
            x={slot.x + SW/2}
            y={slot.y + SH - 22}
            textAnchor="middle"
            fill={text}
            fontSize={fontSub}
            fontWeight="900"
            opacity="0.95"
            letterSpacing="1"
          >
            ↻ {fmtFreeIn(slot.freeAt)}
          </text>
          <text
            x={slot.x + SW/2}
            y={slot.y + SH - 10}
            textAnchor="middle"
            fill={text}
            fontSize={Math.max(7, fontSub - 2)}
            fontWeight="700"
            opacity="0.55"
            letterSpacing="1"
          >
            @ {fmtFreeAt(slot.freeAt)}
          </text>
        </>
      )}
      <title>
        {slot.status === "Available"
          ? `Slot ${slot.slotNumber} — Available`
          : `Slot ${slot.slotNumber} — ${slot.status}${slot.freeAt ? ` · free in ${fmtFreeIn(slot.freeAt)} (at ${fmtFreeAt(slot.freeAt, true)})` : ""}`}
      </title>

      {/* ★ closest-to-entrance badge */}
      {isNearest && (
        <g>
          <circle cx={slot.x + SW - 10} cy={slot.y + 12} r="9" fill="#10b981" />
          <text x={slot.x + SW - 10} y={slot.y + 16} textAnchor="middle" fill="white" fontSize="11" fontWeight="900">★</text>
        </g>
      )}

      {/* hover ring */}
      {isAvail && !selected && (
        <rect
          x={slot.x - 1} y={slot.y - 1}
          width={SW + 2} height={SH + 2}
          fill="transparent" stroke="transparent" strokeWidth="2"
          rx="5"
          className="hover:stroke-[#cabf9e] transition-all"
        />
      )}
    </g>
  );
}

function Legend() {
  const items = [
    { c: "bg-white/30 border-white/40",            l: "AVAILABLE" },
    { c: "bg-[#cabf9e] border-[#cabf9e]",          l: "SELECTED" },
    { c: "bg-sky-400/30 border-sky-400/60",  l: "RESERVED" },
    { c: "bg-[#16202f] border-white/10",           l: "OCCUPIED" },
  ];
  return (
    <div className="flex items-center gap-3 text-[10px] tracking-widest text-[#1e2d44]/70 font-bold flex-wrap">
      {items.map((i) => (
        <span key={i.l} className="flex items-center gap-1.5">
          <span className={`w-3 h-3 rounded border ${i.c}`} />
          {i.l}
        </span>
      ))}
      <span className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-700/40 rounded px-1.5 py-0.5">
        <span className="text-emerald-700 text-[10px] font-black">★</span>
        <span className="text-emerald-900">NEAREST TO ENTRANCE — BEST PICK</span>
      </span>
      <span className="flex items-center gap-1.5 bg-sky-500/15 border border-sky-700/40 rounded px-1.5 py-0.5">
        <span className="text-sky-700 text-[10px] font-black">↻</span>
        <span className="text-sky-900">FREES UP IN — COUNTDOWN</span>
      </span>
    </div>
  );
}

function fmtFreeAt(iso, withDate = false) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (!withDate) return hm;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`;
}

function fmtFreeIn(iso) {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "now";
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h < 24) return m === 0 ? `${h}h` : `${h}h ${m}m`;
  const days = Math.floor(h / 24);
  const rh = h % 24;
  return rh === 0 ? `${days}d` : `${days}d ${rh}h`;
}

function Pill({ children }) {
  return (
    <span className="bg-white/10 border border-white/15 rounded px-2 py-0.5 text-[11px] font-bold tracking-wide">
      {children}
    </span>
  );
}

function Spec({ k, v }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded px-3 py-2">
      <div className="text-[9px] tracking-[0.3em] text-slate-500 font-bold mb-0.5">{k}</div>
      <div className="text-xs font-black text-white truncate">{v}</div>
    </div>
  );
}

function Amenity({ icon, label }) {
  return (
    <div className="flex items-center gap-2 bg-white/30 px-3 py-2">
      <span className="text-base">{icon}</span>
      <span className="text-[10px] tracking-widest font-bold text-[#1e2d44]/80">{label}</span>
    </div>
  );
}
