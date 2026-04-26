import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, getSession } from "../api";
import Shell, { Hero, Cream, Empty, Badge, ErrorBox } from "../components/Shell";
import { Backdrop } from "../components/BookingModal";

const TABS = ["OVERVIEW", "SLOTS", "PRICING", "RESERVATIONS", "PAYMENTS", "USERS"];

export default function Admin() {
  const user = getSession();
  const navigate = useNavigate();
  const [tab, setTab] = useState("OVERVIEW");

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (user.role !== "Admin") navigate("/dashboard");
  }, []);

  if (!user || user.role !== "Admin") return null;

  return (
    <Shell>
      <Hero
        kicker="ADMINISTRATION · MANAGE · OVERSEE"
        title="ADMIN"
        subtitle="Manage slots, pricing, users, and bookings."
      />

      <Cream>
        <div className="flex flex-wrap gap-2 mb-8 border-b border-[#1e2d44]/20 pb-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-[11px] font-black tracking-[0.25em] transition ${
                tab === t
                  ? "bg-[#1e2d44] text-white"
                  : "text-[#1e2d44]/60 hover:text-[#1e2d44] hover:bg-white/30"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "OVERVIEW"     && <Overview     uid={user.userId} />}
        {tab === "SLOTS"        && <SlotsPanel   uid={user.userId} />}
        {tab === "PRICING"      && <PricingPanel uid={user.userId} />}
        {tab === "RESERVATIONS" && <ReservationsPanel uid={user.userId} />}
        {tab === "PAYMENTS"     && <PaymentsPanel uid={user.userId} />}
        {tab === "USERS"        && <UsersPanel   uid={user.userId} />}
      </Cream>
    </Shell>
  );
}

/* ─────────────── OVERVIEW ─────────────── */
function Overview({ uid }) {
  const [s, setS] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { api.adminStats(uid).then(setS).catch((e) => setErr(e.message)); }, [uid]);
  if (err) return <ErrorBox msg={err} onLight />;
  if (!s)  return <div className="text-[#1e2d44]/60 tracking-widest text-center py-12">LOADING…</div>;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
      <Stat label="TOTAL SLOTS"        value={s.totalSlots} />
      <Stat label="AVAILABLE"          value={s.availableSlots} accent="emerald" />
      <Stat label="RESERVED"           value={s.reservedSlots} accent="amber" />
      <Stat label="OCCUPIED"           value={s.occupiedSlots} />
      <Stat label="MAINTENANCE"        value={s.maintenanceSlots} accent="red" />
      <Stat label="USERS"              value={s.totalUsers} />
      <Stat label="ACTIVE BOOKINGS"    value={s.activeReservations} />
      <Stat label="TOTAL REVENUE"      value={`Rs ${Number(s.totalRevenue).toFixed(0)}`} accent="emerald" />
    </div>
  );
}

/* ─────────────── SLOTS ─────────────── */
function SlotsPanel({ uid }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    try { setRows(await api.slots()); } catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!confirm("Delete this slot?")) return;
    try { await api.adminDeleteSlot(uid, id); await load(); }
    catch (e) { setErr(e.message); }
  };

  return (
    <div>
      <div className="flex justify-end mb-6">
        <button onClick={() => setAdding(true)} className="btn-sweep bg-[#1e2d44] hover:bg-[#2a3b52] text-white text-xs font-black tracking-[0.25em] px-5 py-3">
          + ADD SLOT
        </button>
      </div>
      <ErrorBox msg={err} onLight />
      <Table headers={["NUMBER", "LOCATION", "TYPE", "STATUS", ""]}>
        {rows.map((s) => (
          <tr key={s.slotId} className="border-t border-[#1e2d44]/15">
            <Td bold>{s.slotNumber}</Td>
            <Td>{s.location}</Td>
            <Td muted>{s.type}</Td>
            <Td><Badge status={s.status} /></Td>
            <Td align="right">
              <div className="flex justify-end gap-2 whitespace-nowrap">
                <button onClick={() => setEditing(s)} className="text-[10px] tracking-widest font-bold border border-[#1e2d44]/30 hover:bg-[#1e2d44]/10 text-[#1e2d44] px-3 py-1.5">EDIT</button>
                <button onClick={() => remove(s.slotId)} className="text-[10px] tracking-widest font-bold bg-red-700/90 hover:bg-red-700 text-white px-3 py-1.5">DELETE</button>
              </div>
            </Td>
          </tr>
        ))}
      </Table>

      {adding  && <SlotModal uid={uid} onClose={() => setAdding(false)}  onSaved={async () => { setAdding(false);  await load(); }} />}
      {editing && <SlotModal uid={uid} slot={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />}
    </div>
  );
}

function SlotModal({ uid, slot, onClose, onSaved }) {
  const isEdit = !!slot;
  const [form, setForm] = useState({
    slotNumber: slot?.slotNumber || "",
    slotLocation: slot?.location || "",
    slotType: slot?.type || "Car",
    status: slot?.status || "Available",
  });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const change = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      if (isEdit) {
        await api.adminUpdateSlot(uid, slot.slotId, {
          slotLocation: form.slotLocation, slotType: form.slotType, status: form.status,
        });
      } else {
        if (!form.slotNumber || !form.slotLocation) throw new Error("Number and location required");
        await api.adminCreateSlot(uid, form);
      }
      onSaved();
    } catch (e2) { setErr(e2.message); }
    finally { setLoading(false); }
  };

  return (
    <Backdrop onClose={onClose}>
      <div className="bg-[#1e2d44] text-white border border-white/10 rounded-2xl max-w-md w-full p-6 anim-fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="text-[10px] tracking-[0.4em] text-slate-400 mb-1 font-bold">{isEdit ? "MODIFY" : "CREATE"}</div>
        <h3 className="text-3xl font-black mb-5">{isEdit ? "EDIT SLOT" : "NEW SLOT"}</h3>
        <form onSubmit={submit} className="space-y-4">
          <DarkField label="SLOT NUMBER" value={form.slotNumber} onChange={change("slotNumber")} placeholder="A1" mono disabled={isEdit} />
          <DarkField label="LOCATION" value={form.slotLocation} onChange={change("slotLocation")} placeholder="Ground Floor" />
          <div className="grid grid-cols-2 gap-3">
            <DarkSelect label="TYPE" value={form.slotType} onChange={change("slotType")} options={["Car", "Bike", "EV"]} />
            <DarkSelect label="STATUS" value={form.status} onChange={change("status")} options={["Available", "Reserved", "Occupied", "Maintenance"]} />
          </div>
          {err && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</div>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 font-semibold py-3 rounded-lg transition">Cancel</button>
            <button type="submit" disabled={loading} className="btn-sweep flex-1 bg-[#cabf9e] hover:bg-[#b6a880] disabled:opacity-40 text-[#1e2d44] font-black tracking-[0.2em] py-3 rounded-lg">
              {loading ? "SAVING…" : (isEdit ? "SAVE →" : "ADD →")}
            </button>
          </div>
        </form>
      </div>
    </Backdrop>
  );
}

/* ─────────────── PRICING ─────────────── */
function PricingPanel({ uid }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    try { setRows(await api.adminPricing(uid)); } catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!confirm("Delete this pricing rule?")) return;
    try { await api.adminDeletePricing(uid, id); await load(); }
    catch (e) { setErr(e.message); }
  };

  return (
    <div>
      <div className="flex justify-end mb-6">
        <button onClick={() => setAdding(true)} className="btn-sweep bg-[#1e2d44] hover:bg-[#2a3b52] text-white text-xs font-black tracking-[0.25em] px-5 py-3">
          + ADD RULE
        </button>
      </div>
      <ErrorBox msg={err} onLight />
      <Table headers={["TYPE", "PRICE / HOUR", "EFFECTIVE FROM", ""]}>
        {rows.map((p) => (
          <tr key={p.pricingId} className="border-t border-[#1e2d44]/15">
            <Td bold>{p.type}</Td>
            <Td mono>Rs {Number(p.pricePerHour).toFixed(2)}</Td>
            <Td muted>{p.effectiveFrom}</Td>
            <Td align="right">
              <button onClick={() => remove(p.pricingId)} className="text-[10px] tracking-widest font-bold bg-red-700/90 hover:bg-red-700 text-white px-3 py-1.5">DELETE</button>
            </Td>
          </tr>
        ))}
      </Table>

      {adding && <PricingModal uid={uid} onClose={() => setAdding(false)} onSaved={async () => { setAdding(false); await load(); }} />}
    </div>
  );
}

function PricingModal({ uid, onClose, onSaved }) {
  const [form, setForm] = useState({ slotType: "Car", pricePerHour: "", effectiveFrom: new Date().toISOString().slice(0, 10) });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const change = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const price = Number(form.pricePerHour);
      if (!price || price <= 0) throw new Error("Price must be > 0");
      await api.adminCreatePricing(uid, { ...form, pricePerHour: price });
      onSaved();
    } catch (e2) { setErr(e2.message); }
    finally { setLoading(false); }
  };

  return (
    <Backdrop onClose={onClose}>
      <div className="bg-[#1e2d44] text-white border border-white/10 rounded-2xl max-w-md w-full p-6 anim-fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="text-[10px] tracking-[0.4em] text-slate-400 mb-1 font-bold">CREATE</div>
        <h3 className="text-3xl font-black mb-5">PRICING RULE</h3>
        <form onSubmit={submit} className="space-y-4">
          <DarkSelect label="TYPE" value={form.slotType} onChange={change("slotType")} options={["Car", "Bike", "EV"]} />
          <DarkField label="PRICE PER HOUR (Rs)" value={form.pricePerHour} onChange={change("pricePerHour")} placeholder="100" type="number" />
          <DarkField label="EFFECTIVE FROM" value={form.effectiveFrom} onChange={change("effectiveFrom")} type="date" />
          {err && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</div>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 font-semibold py-3 rounded-lg transition">Cancel</button>
            <button type="submit" disabled={loading} className="btn-sweep flex-1 bg-[#cabf9e] hover:bg-[#b6a880] disabled:opacity-40 text-[#1e2d44] font-black tracking-[0.2em] py-3 rounded-lg">
              {loading ? "SAVING…" : "ADD →"}
            </button>
          </div>
        </form>
      </div>
    </Backdrop>
  );
}

/* ─────────────── RESERVATIONS / PAYMENTS / USERS ─────────────── */
function ReservationsPanel({ uid }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  useEffect(() => { api.adminReservations(uid).then(setRows).catch((e) => setErr(e.message)); }, [uid]);
  return (
    <>
      <ErrorBox msg={err} onLight />
      {!err && rows.length === 0 ? (
        <Empty title="No reservations yet" />
      ) : (
        <Table headers={["SLOT", "USER", "VEHICLE", "START", "END", "STATUS", "CODE"]}>
          {rows.map((r) => (
            <tr key={r.reservationId} className="border-t border-[#1e2d44]/15">
              <Td bold>{r.slotNumber}</Td>
              <Td>
                <div className="font-semibold">{r.userName}</div>
                <div className="text-[11px] text-[#1e2d44]/60">{r.userEmail}</div>
              </Td>
              <Td mono>{r.licensePlate}</Td>
              <Td>{fmt(r.startTime)}</Td>
              <Td>{fmt(r.endTime)}</Td>
              <Td><Badge status={r.status} /></Td>
              <Td mono>{r.verificationCode}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}

function PaymentsPanel({ uid }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  useEffect(() => { api.adminPayments(uid).then(setRows).catch((e) => setErr(e.message)); }, [uid]);
  return (
    <>
      <ErrorBox msg={err} onLight />
      {!err && rows.length === 0 ? (
        <Empty title="No payments yet" />
      ) : (
        <Table headers={["USER", "AMOUNT", "METHOD", "STATUS", "DATE"]}>
          {rows.map((p) => (
            <tr key={p.paymentId} className="border-t border-[#1e2d44]/15">
              <Td>{p.userName}</Td>
              <Td bold>Rs {Number(p.amount).toFixed(2)}</Td>
              <Td muted>{p.method}</Td>
              <Td><Badge status={p.status} /></Td>
              <Td muted>{fmt(p.date)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}

function UsersPanel({ uid }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  useEffect(() => { api.adminUsers(uid).then(setRows).catch((e) => setErr(e.message)); }, [uid]);
  return (
    <>
      <ErrorBox msg={err} onLight />
      <Table headers={["NAME", "EMAIL", "PHONE", "ROLE", "JOINED"]}>
        {rows.map((u) => (
          <tr key={u.userId} className="border-t border-[#1e2d44]/15">
            <Td bold>{u.fullName}</Td>
            <Td>{u.email}</Td>
            <Td mono>{u.phone || "—"}</Td>
            <Td>
              <span className={`text-[10px] tracking-widest font-bold px-2 py-1 border ${
                u.role === "Admin"
                  ? "bg-[#1e2d44] text-white border-[#1e2d44]"
                  : "bg-white/40 text-[#1e2d44] border-[#1e2d44]/20"
              }`}>
                {u.role.toUpperCase()}
              </span>
            </Td>
            <Td muted>{u.registrationDate}</Td>
          </tr>
        ))}
      </Table>
    </>
  );
}

/* ─────────────── Helpers ─────────────── */
function Stat({ label, value, accent }) {
  const accents = {
    emerald: "text-emerald-700",
    amber:   "text-amber-700",
    red:     "text-red-700",
  };
  return (
    <div className="bg-[#1e2d44] text-white p-5 anim-fade-up">
      <div className="text-[10px] tracking-[0.3em] text-slate-400 mb-2 font-bold">{label}</div>
      <div className={`text-3xl font-black tracking-tight ${accent ? accents[accent] : "text-white"}`}>{value}</div>
    </div>
  );
}

function Table({ headers, children }) {
  return (
    <div className="border border-[#1e2d44]/30 overflow-x-auto bg-white/20">
      <table className="w-full text-sm">
        <thead className="bg-[#1e2d44] text-white">
          <tr className="text-[10px] tracking-[0.3em]">
            {headers.map((h, i) => (
              <th key={i} className={`px-5 py-3 font-bold ${i === headers.length - 1 ? "text-right" : "text-left"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
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

function DarkField({ label, value, onChange, placeholder, type = "text", mono, disabled }) {
  return (
    <div>
      <label className="block text-[10px] tracking-[0.3em] text-slate-400 mb-2 font-bold">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`input-lift w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/60 focus:bg-white/10 disabled:opacity-50 ${mono ? "font-mono tracking-widest" : ""}`}
      />
    </div>
  );
}

function DarkSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-[10px] tracking-[0.3em] text-slate-400 mb-2 font-bold">{label}</label>
      <select
        value={value}
        onChange={onChange}
        className="input-lift w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/60"
      >
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

function fmt(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
