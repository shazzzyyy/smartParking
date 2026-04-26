import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, getSession } from "../api";
import Shell, { PageHeader, Empty, Badge } from "../components/Shell";
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
      <PageHeader
        title="My reservations"
        subtitle="Bookings, payment status, and verification codes."
      />

      {err && <div className="mb-4 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</div>}

      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">Loading…</div>
      ) : rows.length === 0 ? (
        <Empty
          title="No reservations yet"
          body="Book your first slot from the dashboard."
          action={<Link to="/dashboard" className="btn btn-primary">Find a slot</Link>}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.02] text-slate-400 text-xs">
                <tr>
                  <Th>Slot</Th><Th>Type</Th><Th>Vehicle</Th>
                  <Th>Start</Th><Th>End</Th>
                  <Th>Status</Th><Th>Payment</Th><Th>Code</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.reservationId} className="border-t border-white/5">
                    <Td bold>{r.slotNumber}</Td>
                    <Td muted>{r.slotType}</Td>
                    <Td mono>{r.licensePlate}</Td>
                    <Td>{fmt(r.startTime)}</Td>
                    <Td>{fmt(r.endTime)}</Td>
                    <Td><Badge status={r.status} /></Td>
                    <Td><Badge status={r.paymentStatus} /></Td>
                    <Td mono>{r.verificationCode}</Td>
                    <Td align="right">
                      <div className="flex justify-end gap-2">
                        {r.paymentStatus !== "Paid" && r.status === "Booked" && (
                          <button onClick={() => setPayFor(r)} className="btn btn-primary text-xs px-3 py-1.5">
                            Pay
                          </button>
                        )}
                        {r.status === "Booked" && (
                          <button onClick={() => cancel(r.reservationId)} className="btn btn-danger text-xs px-3 py-1.5">
                            Cancel
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
    setErr("");
    setLoading(true);
    try {
      await api.pay({ reservationId: reservation.reservationId, amount, paymentMethod: method });
      onPaid();
    } catch (e2) { setErr(e2.message); }
    finally { setLoading(false); }
  };

  return (
    <Backdrop onClose={onClose}>
      <div className="card max-w-sm w-full p-6 fade-in">
        <div className="text-xs text-slate-400">Pay for slot {reservation.slotNumber}</div>
        <h3 className="text-3xl font-bold mt-1">Rs {amount.toFixed(2)}</h3>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label className="label">Method</label>
            <div className="grid grid-cols-3 gap-2">
              {["Cash", "Card", "Online"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`py-2.5 text-xs font-semibold rounded-md border transition ${
                    method === m
                      ? "bg-emerald-500 text-slate-950 border-emerald-500"
                      : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          {err && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</div>}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-1">
              {loading ? "Processing…" : "Pay now"}
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
  return <th className={`px-4 py-3 font-medium text-${align}`}>{children}</th>;
}
function Td({ children, align = "left", bold, mono, muted }) {
  const cls = [
    "px-4 py-3",
    `text-${align}`,
    bold && "font-bold",
    mono && "font-mono text-xs",
    muted && "text-slate-400",
  ].filter(Boolean).join(" ");
  return <td className={cls}>{children}</td>;
}
