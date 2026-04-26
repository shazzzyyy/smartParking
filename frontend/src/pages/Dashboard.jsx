import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, getSession } from "../api";
import Shell, { PageHeader, Badge } from "../components/Shell";
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
        setSlots(ss);
        setLocations(ls);
        setPricing(pr);
        setVehicles(vs);
        if (ls.length > 0) setLocation(ls[0]);
      } catch (e) { setErr(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  const refresh = async () => {
    try { setSlots(await api.slots()); } catch (e) { setErr(e.message); }
  };

  if (!user) return null;

  const inLocation = slots.filter((s) => s.location === location);
  const selectedSlot = slots.find((s) => s.slotId === selectedId);
  const priceFor = (type) => {
    const p = pricing.find((x) => x.type === type);
    return p ? Number(p.pricePerHour) : 0;
  };
  const rate = selectedSlot ? priceFor(selectedSlot.type) : 0;

  const counts = {
    available: slots.filter((s) => s.status === "Available").length,
    occupied:  slots.filter((s) => s.status === "Occupied").length,
    reserved:  slots.filter((s) => s.status === "Reserved").length,
    total:     slots.length,
  };

  return (
    <Shell>
      <PageHeader
        title="Find a parking slot"
        subtitle="Select an available slot from the floor plan to book."
      />

      {err && (
        <div className="mb-4 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <Stat label="Total" value={counts.total} />
            <Stat label="Available" value={counts.available} tone="emerald" />
            <Stat label="Reserved" value={counts.reserved} tone="amber" />
            <Stat label="Occupied" value={counts.occupied} tone="slate" />
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex gap-2 flex-wrap">
                {locations.map((loc) => (
                  <button
                    key={loc}
                    onClick={() => { setLocation(loc); setSelectedId(null); }}
                    className={`px-3 py-1.5 text-xs rounded-md transition ${
                      location === loc
                        ? "bg-white text-slate-900 font-semibold"
                        : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
              <Legend />
            </div>

            {loading ? (
              <div className="text-center py-12 text-slate-500 text-sm">Loading layout…</div>
            ) : inLocation.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">No slots at {location}</div>
            ) : (
              <FloorPlan
                slots={inLocation}
                selectedId={selectedId}
                onSelect={(id) => setSelectedId(id)}
              />
            )}
          </div>
        </div>

        <aside className="lg:col-span-4 space-y-4">
          <div className="card p-5">
            <div className="text-xs text-slate-400 mb-2">Selected slot</div>
            {!selectedSlot ? (
              <div className="text-sm text-slate-500 py-4">Click an available slot on the map.</div>
            ) : (
              <>
                <div className="flex items-baseline justify-between">
                  <h2 className="text-3xl font-bold">{selectedSlot.slotNumber}</h2>
                  <Badge status={selectedSlot.status} />
                </div>
                <div className="text-sm text-slate-400 mt-1">{selectedSlot.location}</div>
                <div className="border-t border-white/5 mt-4 pt-4 space-y-2 text-sm">
                  <Line k="Type" v={selectedSlot.type} />
                  <Line k="Rate" v={`Rs ${rate}/hr`} />
                </div>
                <button
                  className="btn btn-primary w-full mt-4"
                  onClick={() => setShowBooking(true)}
                  disabled={selectedSlot.status !== "Available"}
                >
                  Book this slot
                </button>
              </>
            )}
          </div>

          <div className="card p-5">
            <div className="text-xs text-slate-400 mb-3">Pricing</div>
            <div className="space-y-2 text-sm">
              {pricing.map((p) => (
                <Line key={p.type} k={p.type} v={`Rs ${Number(p.pricePerHour).toFixed(0)}/hr`} />
              ))}
              {pricing.length === 0 && <div className="text-slate-500 text-xs">No pricing rules</div>}
            </div>
          </div>
        </aside>
      </div>

      {showBooking && selectedSlot && (
        <BookingModal
          slot={selectedSlot}
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

/* ─────────────── Floor plan ─────────────── */
function FloorPlan({ slots, selectedId, onSelect }) {
  // Split into two rows facing each other across an aisle
  const half = Math.ceil(slots.length / 2);
  const top = slots.slice(0, half);
  const bottom = slots.slice(half);

  return (
    <div className="bg-[#0d1220] border border-white/5 rounded-lg p-4">
      <div className="text-[10px] tracking-[0.3em] text-slate-500 mb-3 text-center">FLOOR PLAN · TOP-DOWN VIEW</div>

      <div className="space-y-2">
        <SlotRow slots={top} selectedId={selectedId} onSelect={onSelect} flip={false} />
        <Aisle />
        {bottom.length > 0 && <SlotRow slots={bottom} selectedId={selectedId} onSelect={onSelect} flip={true} />}
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-[10px] tracking-[0.25em] text-slate-500">
        <span>↑</span>
        <span>ENTRANCE</span>
      </div>
    </div>
  );
}

function Aisle() {
  return (
    <div className="relative h-7 my-1">
      <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-px border-t border-dashed border-white/10" />
      <div className="absolute inset-0 flex items-center justify-center text-[9px] tracking-[0.3em] text-slate-600">DRIVE LANE</div>
    </div>
  );
}

function SlotRow({ slots, selectedId, onSelect, flip }) {
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))` }}
    >
      {slots.map((s) => (
        <SlotCell key={s.slotId} slot={s} selected={selectedId === s.slotId} onSelect={onSelect} flip={flip} />
      ))}
    </div>
  );
}

function SlotCell({ slot, selected, onSelect, flip }) {
  const isAvailable = slot.status === "Available";
  const styles = {
    Available: "bg-emerald-500/15 border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/25 cursor-pointer",
    Occupied:  "bg-slate-700/40 border-slate-600/40 text-slate-400",
    Reserved:  "bg-amber-500/15 border-amber-500/40 text-amber-200",
    Maintenance: "bg-red-500/10 border-red-500/30 text-red-300 [background-image:repeating-linear-gradient(45deg,transparent_0_5px,rgba(239,68,68,0.1)_5px_10px)]",
  };
  return (
    <div
      onClick={() => isAvailable && onSelect(slot.slotId)}
      className={`relative aspect-[3/4] rounded border-2 flex flex-col items-center justify-center text-xs font-bold transition ${
        styles[slot.status] || ""
      } ${selected ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#0d1220]" : ""} ${
        flip ? "rotate-180" : ""
      }`}
    >
      <div className={flip ? "rotate-180" : ""}>
        <div className="text-base">{slot.slotNumber}</div>
        <div className="text-[8px] tracking-widest text-slate-400/80 mt-0.5">
          {slot.type === "Bike" ? "BIKE" : slot.type === "EV" ? "EV" : "CAR"}
        </div>
      </div>
    </div>
  );
}

function Legend() {
  const items = [
    { c: "bg-emerald-500/40", l: "Available" },
    { c: "bg-amber-500/40",   l: "Reserved" },
    { c: "bg-slate-600",      l: "Occupied" },
    { c: "bg-red-500/30",     l: "Maintenance" },
  ];
  return (
    <div className="flex items-center gap-3 text-[10px] tracking-wider text-slate-400">
      {items.map((i) => (
        <span key={i.l} className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-sm ${i.c}`} />
          {i.l}
        </span>
      ))}
    </div>
  );
}

function Stat({ label, value, tone = "default" }) {
  const colors = {
    emerald: "text-emerald-400",
    amber:   "text-amber-400",
    slate:   "text-slate-400",
    default: "text-slate-100",
  };
  return (
    <div className="card p-4">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className={`text-2xl font-bold mt-0.5 ${colors[tone]}`}>{value}</div>
    </div>
  );
}

function Line({ k, v }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400 text-xs">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
