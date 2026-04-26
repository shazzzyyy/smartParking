import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, getSession, setSession } from "../api";

export default function Reservations() {
  const user = getSession();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [payFor, setPayFor] = useState(null);

  const load = async () => {
    try {
      const data = await api.myReservations(user.userId);
      setRows(data);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    load();
  }, []);

  const cancel = async (id) => {
    if (!confirm("Cancel this reservation?")) return;
    try {
      await api.cancelReservation(id, user.userId);
      await load();
    } catch (e) { setErr(e.message); }
  };

  const logout = () => { setSession(null); navigate("/login"); };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#1f2d44] text-white flex flex-col">
      {/* ====== Header (matches Dashboard) ====== */}
      <header className="border-b border-white/10 bg-[#1f2d44]">
        <div className="px-8 lg:px-14 py-5 flex items-center justify-between anim-slide-down">
          <div className="flex items-center gap-10">
            <Link to="/dashboard" className="leading-[1.1]">
              <div className="text-[13px] font-black tracking-[0.15em] text-white">SMART</div>
              <div className="text-[13px] font-black tracking-[0.15em] text-white">PARKING</div>
            </Link>
            <nav className="hidden md:flex items-center gap-7 text-sm">
              <Link to="/dashboard" className="text-slate-400 hover:text-slate-200 transition pb-1">Dashboard</Link>
              <Link to="/reservations" className="text-white font-bold border-b-2 border-white pb-1">Reservations</Link>
            </nav>
          </div>
          <div className="flex items-center gap-5 text-sm">
            <div className="hidden md:block text-right leading-tight">
              <div className="text-white font-semibold">{user.fullName}</div>
              <div className="text-slate-400 text-xs tracking-wider">{user.email}</div>
            </div>
            <button onClick={logout} className="text-xs text-slate-400 hover:text-white tracking-[0.25em]">
              LOGOUT
            </button>
          </div>
        </div>
      </header>

      {/* ====== Hero ====== */}
      <section className="bg-[#1f2d44] px-8 lg:px-14 pt-10 pb-14 anim-fade-up">
        <div className="text-xs tracking-[0.4em] text-slate-400 mb-3">
          YOUR · BOOKINGS · PAYMENTS
        </div>
        <h1 className="text-6xl lg:text-8xl font-black leading-[0.9] tracking-tight">
          RESERVATIONS
        </h1>
        <p className="mt-4 text-sm text-slate-300 max-w-md leading-relaxed">
          All your parking reservations with payment status and verification codes.
        </p>
      </section>

      {/* ====== Cream section with table ====== */}
      <main className="flex-1 bg-gradient-to-b from-[#cabf9e] to-[#b6a880] text-[#1e2d44] px-8 lg:px-14 py-12">
        {err && (
          <div className="mb-6 text-xs text-red-900 bg-red-200/60 border border-red-900/30 rounded-lg px-3 py-2">
            {err}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 tracking-widest text-[#1e2d44]/60">LOADING…</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-[10px] tracking-[0.4em] text-[#1e2d44]/60 mb-2 font-bold">EMPTY</div>
            <h2 className="text-3xl font-black mb-3">No reservations yet</h2>
            <Link to="/dashboard" className="inline-block mt-4 bg-[#1e2d44] hover:bg-[#2a3b52] text-white font-black tracking-[0.2em] px-6 py-3 transition">
              BOOK A SLOT →
            </Link>
          </div>
        ) : (
          <div className="border border-[#1e2d44]/30 overflow-x-auto bg-white/20">
            <table className="w-full text-sm">
              <thead className="bg-[#1e2d44] text-white">
                <tr className="text-[10px] tracking-[0.3em]">
                  <th className="text-left px-5 py-3 font-bold">SLOT</th>
                  <th className="text-left px-5 py-3 font-bold">TYPE</th>
                  <th className="text-left px-5 py-3 font-bold">VEHICLE</th>
                  <th className="text-left px-5 py-3 font-bold">START</th>
                  <th className="text-left px-5 py-3 font-bold">END</th>
                  <th className="text-left px-5 py-3 font-bold">STATUS</th>
                  <th className="text-left px-5 py-3 font-bold">PAYMENT</th>
                  <th className="text-left px-5 py-3 font-bold">CODE</th>
                  <th className="text-right px-5 py-3 font-bold">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.reservationId} className="border-t border-[#1e2d44]/15">
                    <td className="px-5 py-4 font-black">{r.slotNumber}</td>
                    <td className="px-5 py-4 text-xs tracking-widest">{r.slotType}</td>
                    <td className="px-5 py-4 font-mono text-xs tracking-wider">{r.licensePlate}</td>
                    <td className="px-5 py-4 text-xs">{formatTime(r.startTime)}</td>
                    <td className="px-5 py-4 text-xs">{formatTime(r.endTime)}</td>
                    <td className="px-5 py-4">
                      <Badge status={r.status} />
                    </td>
                    <td className="px-5 py-4">
                      <Badge status={r.paymentStatus} payment />
                    </td>
                    <td className="px-5 py-4 font-mono text-xs tracking-widest">{r.verificationCode}</td>
                    <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                      {r.paymentStatus !== "Paid" && r.status === "Booked" && (
                        <button
                          onClick={() => setPayFor(r)}
                          className="text-[10px] tracking-widest font-bold bg-[#1e2d44] hover:bg-[#2a3b52] text-white px-3 py-1.5"
                        >
                          PAY
                        </button>
                      )}
                      {r.status === "Booked" && (
                        <button
                          onClick={() => cancel(r.reservationId)}
                          className="text-[10px] tracking-widest font-bold border border-[#1e2d44]/30 hover:bg-[#1e2d44]/10 text-[#1e2d44] px-3 py-1.5"
                        >
                          CANCEL
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {payFor && (
        <PayModal
          reservation={payFor}
          onClose={() => setPayFor(null)}
          onPaid={async () => { setPayFor(null); await load(); }}
        />
      )}
    </div>
  );
}

function formatTime(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Badge({ status, payment }) {
  const s = status || "—";
  const colors = {
    Booked: "bg-emerald-500/20 text-emerald-900 border-emerald-900/30",
    Active: "bg-emerald-500/20 text-emerald-900 border-emerald-900/30",
    Completed: "bg-[#1e2d44]/15 text-[#1e2d44] border-[#1e2d44]/20",
    Cancelled: "bg-red-500/20 text-red-900 border-red-900/30",
    Paid: "bg-emerald-500/20 text-emerald-900 border-emerald-900/30",
    Unpaid: "bg-amber-500/20 text-amber-900 border-amber-900/40",
    Pending: "bg-amber-500/20 text-amber-900 border-amber-900/40",
    Failed: "bg-red-500/20 text-red-900 border-red-900/30",
  };
  return (
    <span className={`text-[10px] tracking-widest font-bold px-2 py-1 border ${colors[s] || "bg-white/40 text-[#1e2d44]"}`}>
      {s.toUpperCase()}
    </span>
  );
}

function PayModal({ reservation, onClose, onPaid }) {
  const amount = Number(reservation.amount || 0);
  const [method, setMethod] = useState("Cash");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await api.pay({
        reservationId: reservation.reservationId,
        amount,
        paymentMethod: method,
      });
      onPaid();
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
        className="bg-[#1e2d44] text-white border border-white/10 rounded-2xl max-w-sm w-full p-6 anim-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[10px] tracking-[0.4em] text-slate-400 mb-1 font-bold">PAYMENT</div>
        <h3 className="text-3xl font-black mb-1">Rs {amount.toFixed(2)}</h3>
        <p className="text-xs text-slate-400 tracking-wide mb-6">
          Slot {reservation.slotNumber} · {reservation.verificationCode}
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-[10px] tracking-[0.3em] text-slate-400 mb-2 font-bold">METHOD</label>
            <div className="grid grid-cols-3 gap-2">
              {["Cash", "Card", "Online"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`py-3 text-xs tracking-widest font-bold border transition ${
                    method === m
                      ? "bg-[#cabf9e] border-[#cabf9e] text-[#1e2d44]"
                      : "bg-white/5 border-white/15 text-white hover:bg-white/10"
                  }`}
                >
                  {m.toUpperCase()}
                </button>
              ))}
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
              disabled={loading}
              className="btn-sweep flex-1 bg-[#cabf9e] hover:bg-[#b6a880] disabled:opacity-40 text-[#1e2d44] font-black tracking-[0.2em] py-3 rounded-lg"
            >
              {loading ? "PAYING…" : "PAY →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
