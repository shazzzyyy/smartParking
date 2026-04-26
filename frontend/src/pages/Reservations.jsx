import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, getSession } from "../api";
import Shell, { Hero, Cream, Badge, Empty, ErrorBox } from "../components/Shell";
import { Backdrop } from "../components/BookingModal";

export default function Reservations() {
  const user = getSession();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [payFor, setPayFor] = useState(null);

  const load = async () => {
    try { setRows(await api.myReservations(user.userId)); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    load();
  }, []);

  const cancel = async (id) => {
    if (!confirm("Cancel this reservation?")) return;
    try { await api.cancelReservation(id, user.userId); await load(); }
    catch (e) { setErr(e.message); }
  };

  if (!user) return null;

  return (
    <Shell>
      <Hero
        kicker="YOUR · BOOKINGS · PAYMENTS"
        title="RESERVATIONS"
        subtitle="All your parking reservations with payment status and verification codes."
      />

      <Cream>
        <ErrorBox msg={err} onLight />

        {loading ? (
          <div className="text-center py-20 tracking-widest text-[#1e2d44]/60">LOADING…</div>
        ) : rows.length === 0 ? (
          <Empty
            title="No reservations yet"
            body="Book your first slot from the dashboard."
            action={
              <Link to="/dashboard" className="btn-sweep inline-block bg-[#1e2d44] hover:bg-[#2a3b52] text-white font-black tracking-[0.2em] px-6 py-3 transition">
                BOOK A SLOT →
              </Link>
            }
          />
        ) : (
          <div className="border border-[#1e2d44]/30 overflow-x-auto bg-white/20">
            <table className="w-full text-sm">
              <thead className="bg-[#1e2d44] text-white">
                <tr className="text-[10px] tracking-[0.3em]">
                  <Th>SLOT</Th><Th>TYPE</Th><Th>VEHICLE</Th>
                  <Th>START</Th><Th>END</Th>
                  <Th>STATUS</Th><Th>PAYMENT</Th><Th>CODE</Th>
                  <Th align="right">ACTION</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.reservationId} className="border-t border-[#1e2d44]/15">
                    <Td bold>{r.slotNumber}</Td>
                    <Td muted>{r.slotType}</Td>
                    <Td mono>{r.licensePlate}</Td>
                    <Td>{fmt(r.startTime)}</Td>
                    <Td>{fmt(r.endTime)}</Td>
                    <Td><Badge status={r.status} /></Td>
                    <Td><Badge status={r.paymentStatus} /></Td>
                    <Td mono>{r.verificationCode}</Td>
                    <Td align="right">
                      <div className="flex justify-end gap-2 whitespace-nowrap">
                        {r.paymentStatus !== "Paid" && r.status === "Booked" && (
                          <button onClick={() => setPayFor(r)} className="text-[10px] tracking-widest font-bold bg-[#1e2d44] hover:bg-[#2a3b52] text-white px-3 py-1.5">
                            PAY
                          </button>
                        )}
                        {r.status === "Booked" && (
                          <button onClick={() => cancel(r.reservationId)} className="text-[10px] tracking-widest font-bold border border-[#1e2d44]/30 hover:bg-[#1e2d44]/10 text-[#1e2d44] px-3 py-1.5">
                            CANCEL
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cream>

      {payFor && (
        <PayModal
          reservation={payFor}
          onClose={() => setPayFor(null)}
          onPaid={async () => { setPayFor(null); await load(); }}
        />
      )}
    </Shell>
  );
}

function PayModal({ reservation, onClose, onPaid }) {
  const amount = Number(reservation.amount || 0);
  const [method, setMethod] = useState("Cash");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      await api.pay({ reservationId: reservation.reservationId, amount, paymentMethod: method });
      onPaid();
    } catch (e2) { setErr(e2.message); }
    finally { setLoading(false); }
  };

  return (
    <Backdrop onClose={onClose}>
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

          {err && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</div>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 font-semibold py-3 rounded-lg transition">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-sweep flex-1 bg-[#cabf9e] hover:bg-[#b6a880] disabled:opacity-40 text-[#1e2d44] font-black tracking-[0.2em] py-3 rounded-lg">
              {loading ? "PAYING…" : "PAY →"}
            </button>
          </div>
        </form>
      </div>
    </Backdrop>
  );
}

function fmt(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Th({ children, align = "left" }) {
  return <th className={`px-5 py-3 font-bold text-${align}`}>{children}</th>;
}
function Td({ children, align = "left", bold, mono, muted }) {
  const cls = [
    "px-5 py-4",
    `text-${align}`,
    bold && "font-black",
    mono && "font-mono text-xs tracking-widest",
    muted && "text-xs tracking-widest",
  ].filter(Boolean).join(" ");
  return <td className={cls}>{children}</td>;
}
