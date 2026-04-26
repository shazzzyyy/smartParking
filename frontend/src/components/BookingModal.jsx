import { useMemo, useState } from "react";
import { api } from "../api";

function roundToNextHour(d = new Date()) {
  const out = new Date(d);
  out.setMinutes(0, 0, 0);
  out.setHours(out.getHours() + 1);
  return out;
}
function fmt(dt) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export default function BookingModal({ slot, vehicles, rate, userId, onClose, onBooked }) {
  const compatible = vehicles.filter((v) => v.type === slot.type);
  const initialVehicle = compatible[0] || vehicles[0] || null;

  const [vehicleId, setVehicleId] = useState(initialVehicle?.vehicleId ?? "");
  const [start, setStart] = useState(fmt(roundToNextHour()));
  const [end, setEnd] = useState(fmt(new Date(roundToNextHour().getTime() + 2 * 3600 * 1000)));
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const hours = useMemo(() => {
    const s = new Date(start);
    const e = new Date(end);
    return Math.max(0, (e - s) / 3600000);
  }, [start, end]);
  const total = useMemo(() => Math.round(hours * rate * 100) / 100, [hours, rate]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!vehicleId) {
      setErr("Please select a vehicle");
      return;
    }
    if (!(new Date(end) > new Date(start))) {
      setErr("End time must be after start time");
      return;
    }
    setLoading(true);
    try {
      const res = await api.createReservation({
        userId,
        vehicleId: Number(vehicleId),
        slotId: slot.slotId,
        startTime: start + ":00",
        endTime: end + ":00",
      });
      setResult(res);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1e2d44] text-white border border-white/10 rounded-2xl max-w-md w-full overflow-hidden anim-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Pill>{slot.location}</Pill>
            <Pill>№ {slot.slotNumber}</Pill>
            <Pill>{slot.type}</Pill>
          </div>
          <h2 className="text-4xl font-black leading-none">
            SLOT {slot.slotNumber}
          </h2>
          <p className="text-xs tracking-widest text-slate-400 mt-2">
            Rs {rate} / HOUR
          </p>
        </div>

        {!result ? (
          <form onSubmit={submit} className="p-6 space-y-4">
            <div>
              <label className="block text-[10px] tracking-[0.3em] text-slate-400 mb-2 font-bold">
                VEHICLE
              </label>
              {vehicles.length === 0 ? (
                <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                  No vehicles found. Register a vehicle in the Reservations page first.
                </div>
              ) : (
                <select
                  required
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  className="input-lift w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/60"
                >
                  <option value="">Select vehicle…</option>
                  {vehicles.map((v) => (
                    <option
                      key={v.vehicleId}
                      value={v.vehicleId}
                      disabled={v.type !== slot.type}
                    >
                      {v.licensePlate} — {v.brand} {v.model} ({v.type})
                      {v.type !== slot.type ? " · wrong type" : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] tracking-[0.3em] text-slate-400 mb-2 font-bold">
                  START
                </label>
                <input
                  type="datetime-local"
                  required
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="input-lift w-full bg-white/5 border border-white/15 rounded-lg px-3 py-3 text-white text-sm focus:outline-none focus:border-white/60"
                />
              </div>
              <div>
                <label className="block text-[10px] tracking-[0.3em] text-slate-400 mb-2 font-bold">
                  END
                </label>
                <input
                  type="datetime-local"
                  required
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="input-lift w-full bg-white/5 border border-white/15 rounded-lg px-3 py-3 text-white text-sm focus:outline-none focus:border-white/60"
                />
              </div>
            </div>

            <div className="bg-[#16202f] border border-white/10 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400 text-xs tracking-wider uppercase">Duration</span>
                <span className="font-semibold">{hours.toFixed(1)} hrs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-xs tracking-wider uppercase">Rate</span>
                <span className="font-semibold">Rs {rate}/h</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2 mt-1">
                <span className="text-slate-400 text-xs tracking-wider uppercase">Total</span>
                <span className="font-black text-lg">Rs {total}</span>
              </div>
            </div>

            {err && (
              <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                {err}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 font-semibold py-3 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || vehicles.length === 0}
                className="btn-sweep flex-1 bg-[#cabf9e] hover:bg-[#b6a880] disabled:opacity-40 text-[#1e2d44] font-black tracking-[0.2em] py-3 rounded-lg transition"
              >
                {loading ? "BOOKING…" : "CONFIRM →"}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 text-center space-y-5">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-3xl">
              ✓
            </div>
            <div>
              <div className="text-[10px] tracking-[0.4em] text-emerald-400 mb-1 font-bold">
                RESERVATION CONFIRMED
              </div>
              <div className="text-xs tracking-widest text-slate-400">Verification code</div>
              <div className="text-4xl font-black tracking-[0.2em] my-2 text-gradient-anim">
                {result.verificationCode}
              </div>
              <div className="text-sm text-slate-400">
                Show this code at check-in. Amount:{" "}
                <span className="text-white font-black">Rs {Number(result.amount).toFixed(2)}</span>
              </div>
            </div>
            <button
              onClick={onBooked}
              className="btn-sweep w-full bg-white hover:bg-slate-100 text-[#1e2d44] font-black tracking-[0.2em] py-3 rounded-lg"
            >
              DONE
            </button>
          </div>
        )}
      </div>
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
