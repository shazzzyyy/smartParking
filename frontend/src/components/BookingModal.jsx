import { useMemo, useState } from "react";
import { api } from "../api";

function nextHour(d = new Date()) {
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
  const initial = compatible[0] || vehicles[0] || null;

  const [vehicleId, setVehicleId] = useState(initial?.vehicleId ?? "");
  const [start, setStart] = useState(fmt(nextHour()));
  const [end, setEnd] = useState(fmt(new Date(nextHour().getTime() + 2 * 3600 * 1000)));
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const hours = useMemo(() => {
    const s = new Date(start), e = new Date(end);
    return Math.max(0, (e - s) / 3600000);
  }, [start, end]);
  const total = useMemo(() => Math.round(hours * rate * 100) / 100, [hours, rate]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!vehicleId) return setErr("Select a vehicle");
    if (!(new Date(end) > new Date(start))) return setErr("End must be after start");
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
    <Backdrop onClose={onClose}>
      <div className="card max-w-md w-full p-6 fade-in">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs text-slate-400">Slot {slot.slotNumber} · {slot.location}</div>
            <h3 className="text-xl font-bold mt-0.5">{slot.type} Parking</h3>
          </div>
          <span className="text-sm text-slate-400">Rs {rate}/hr</span>
        </div>

        {!result ? (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Vehicle</label>
              {vehicles.length === 0 ? (
                <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                  No vehicles registered. Add one from the Vehicles page.
                </div>
              ) : (
                <select
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Select vehicle…</option>
                  {vehicles.map((v) => (
                    <option key={v.vehicleId} value={v.vehicleId} disabled={v.type !== slot.type}>
                      {v.licensePlate} — {v.brand} {v.model} ({v.type})
                      {v.type !== slot.type ? " · wrong type" : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Start</label>
                <input type="datetime-local" className="input" value={start} onChange={(e) => setStart(e.target.value)} required />
              </div>
              <div>
                <label className="label">End</label>
                <input type="datetime-local" className="input" value={end} onChange={(e) => setEnd(e.target.value)} required />
              </div>
            </div>

            <div className="border border-white/5 rounded-lg p-3 text-sm space-y-1.5 bg-white/[0.02]">
              <Row k="Duration" v={`${hours.toFixed(1)} hrs`} />
              <Row k="Rate" v={`Rs ${rate}/hr`} />
              <div className="border-t border-white/5 pt-1.5 mt-1.5">
                <Row k="Total" v={`Rs ${total.toFixed(2)}`} bold />
              </div>
            </div>

            {err && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</div>}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={loading || vehicles.length === 0} className="btn btn-primary flex-1">
                {loading ? "Booking…" : "Confirm booking"}
              </button>
            </div>
          </form>
        ) : (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-xl">✓</div>
            <div>
              <div className="text-xs text-emerald-400 font-semibold">Reservation confirmed</div>
              <div className="text-xs text-slate-400 mt-3">Verification code</div>
              <div className="text-3xl font-bold tracking-[0.2em] mt-1">{result.verificationCode}</div>
              <div className="text-xs text-slate-400 mt-3">
                Show this code at check-in. Total: <span className="text-white font-semibold">Rs {Number(result.amount).toFixed(2)}</span>
              </div>
            </div>
            <button onClick={onBooked} className="btn btn-primary w-full">Done</button>
          </div>
        )}
      </div>
    </Backdrop>
  );
}

export function Backdrop({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full flex justify-center">
        {children}
      </div>
    </div>
  );
}

function Row({ k, v, bold }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400 text-xs">{k}</span>
      <span className={bold ? "font-bold text-base" : "text-slate-100"}>{v}</span>
    </div>
  );
}
