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
  const [extendFor, setExtendFor] = useState(null);

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

  const checkIn = async (code) => {
    try { await api.checkInReservation(code); await load(); }
    catch (e) { setErr(e.message); }
  };

  const checkOut = async (id) => {
    if (!confirm("Check out now? This ends your parking session.")) return;
    try {
      const r = await api.checkOutReservation(id, user.userId);
      alert(`Checked out. Final amount: Rs ${Number(r.finalAmount || 0).toFixed(2)}`);
      await load();
    } catch (e) { setErr(e.message); }
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
                        {r.status === "Booked" && r.paymentStatus === "Paid" && !r.checkInTime && (
                          <button onClick={() => checkIn(r.verificationCode)} className="text-[10px] tracking-widest font-bold bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5">
                            CHECK IN
                          </button>
                        )}
                        {r.status === "Booked" && r.checkInTime && !r.checkOutTime && (
                          <button onClick={() => checkOut(r.reservationId)} className="text-[10px] tracking-widest font-bold bg-amber-700 hover:bg-amber-800 text-white px-3 py-1.5">
                            CHECK OUT
                          </button>
                        )}
                        {r.status === "Booked" && !r.checkOutTime && (
                          <button onClick={() => setExtendFor(r)} className="text-[10px] tracking-widest font-bold border border-[#1e2d44]/30 hover:bg-[#1e2d44]/10 text-[#1e2d44] px-3 py-1.5">
                            EXTEND
                          </button>
                        )}
                        {r.status === "Booked" && !r.checkInTime && (
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
      {extendFor && (
        <ExtendModal
          reservation={extendFor}
          userId={user.userId}
          onClose={() => setExtendFor(null)}
          onSubmitted={async () => { setExtendFor(null); await load(); }}
        />
      )}
    </Shell>
  );
}

function ExtendModal({ reservation, userId, onClose, onSubmitted }) {
  const currentEnd = new Date(reservation.endTime);
  const initial = new Date(currentEnd.getTime() + 60 * 60 * 1000);
  const fmtLocal = (d) => {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [requestedEnd, setRequestedEnd] = useState(fmtLocal(initial));
  const [note, setNote] = useState("");
  const [history, setHistory] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.myExtensions(reservation.reservationId, userId)
      .then(setHistory)
      .catch(() => {});
  }, [reservation.reservationId, userId]);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      if (!(new Date(requestedEnd) > currentEnd)) throw new Error("Must be after current end time");
      await api.requestExtension(reservation.reservationId, {
        userId,
        requestedEndTime: requestedEnd + ":00",
        userNote: note || null,
      });
      onSubmitted();
    } catch (e2) { setErr(e2.message); }
    finally { setLoading(false); }
  };

  const pending = history.find((h) => h.status === "Pending");

  return (
    <Backdrop onClose={onClose}>
      <div className="bg-[#1e2d44] text-white border border-white/10 rounded-2xl max-w-md w-full p-6 anim-fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="text-[10px] tracking-[0.4em] text-slate-400 mb-1 font-bold">REQUEST</div>
        <h3 className="text-3xl font-black mb-1">EXTEND TIME</h3>
        <p className="text-xs text-slate-400 tracking-wide mb-5">
          Slot {reservation.slotNumber} · ends {fmt(reservation.endTime)}
        </p>

        {pending ? (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-sm">
            <div className="text-[10px] tracking-[0.3em] text-amber-300 mb-1 font-bold">PENDING REVIEW</div>
            <div>Requested end: <span className="font-mono">{fmt(pending.requestedEndTime)}</span></div>
            {pending.userNote && <div className="mt-1 text-slate-300">"{pending.userNote}"</div>}
            <button onClick={onClose} className="mt-3 text-[10px] tracking-widest font-bold bg-white/10 hover:bg-white/20 px-4 py-2">CLOSE</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-[10px] tracking-[0.3em] text-slate-400 mb-2 font-bold">NEW END TIME</label>
              <input
                type="datetime-local"
                required
                value={requestedEnd}
                onChange={(e) => setRequestedEnd(e.target.value)}
                className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/60"
              />
            </div>
            <div>
              <label className="block text-[10px] tracking-[0.3em] text-slate-400 mb-2 font-bold">NOTE (OPTIONAL)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Stuck in a meeting…"
                maxLength={200}
                className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/60 text-sm"
              />
            </div>

            {err && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</div>}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 font-semibold py-3 rounded-lg transition">Cancel</button>
              <button type="submit" disabled={loading} className="btn-sweep flex-1 bg-[#cabf9e] hover:bg-[#b6a880] disabled:opacity-40 text-[#1e2d44] font-black tracking-[0.2em] py-3 rounded-lg">
                {loading ? "SENDING…" : "REQUEST →"}
              </button>
            </div>
          </form>
        )}

        {history.length > 0 && (
          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="text-[10px] tracking-[0.3em] text-slate-500 font-bold mb-2">PREVIOUS REQUESTS</div>
            <div className="space-y-2 max-h-32 overflow-y-auto text-xs">
              {history.map((h) => (
                <div key={h.extensionRequestId} className="flex justify-between gap-2 text-slate-400">
                  <span className="font-mono">{fmt(h.requestedEndTime)}</span>
                  <span className={
                    h.status === "Approved" ? "text-emerald-400" :
                    h.status === "Denied"   ? "text-red-400" : "text-amber-400"
                  }>{h.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Backdrop>
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
