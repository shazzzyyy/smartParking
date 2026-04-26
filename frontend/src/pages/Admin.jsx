import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, getSession } from "../api";
import Shell, { PageHeader, Empty, Badge } from "../components/Shell";
import { Backdrop } from "../components/BookingModal";

const TABS = ["Overview", "Slots", "Pricing", "Reservations", "Payments", "Users"];

export default function Admin() {
  const user = getSession();
  const navigate = useNavigate();
  const [tab, setTab] = useState("Overview");

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (user.role !== "Admin") navigate("/dashboard");
  }, []);

  if (!user || user.role !== "Admin") return null;

  return (
    <Shell>
      <PageHeader title="Admin console" subtitle="Manage slots, pricing, users, and bookings." />

      <div className="flex flex-wrap gap-1 border-b border-white/5 mb-6">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm rounded-t-md transition ${
              tab === t ? "bg-white/5 text-white font-semibold border-b-2 border-emerald-400" : "text-slate-400 hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview"     && <Overview     uid={user.userId} />}
      {tab === "Slots"        && <SlotsPanel   uid={user.userId} />}
      {tab === "Pricing"      && <PricingPanel uid={user.userId} />}
      {tab === "Reservations" && <ReservationsPanel uid={user.userId} />}
      {tab === "Payments"     && <PaymentsPanel uid={user.userId} />}
      {tab === "Users"        && <UsersPanel   uid={user.userId} />}
    </Shell>
  );
}

/* ─────────────── Overview ─────────────── */
function Overview({ uid }) {
  const [s, setS] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { api.adminStats(uid).then(setS).catch((e) => setErr(e.message)); }, [uid]);
  if (err) return <ErrorBox msg={err} />;
  if (!s)  return <div className="text-slate-500 text-sm">Loading…</div>;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Stat label="Total slots" value={s.totalSlots} />
      <Stat label="Available"    value={s.availableSlots} tone="emerald" />
      <Stat label="Reserved"     value={s.reservedSlots}  tone="amber" />
      <Stat label="Occupied"     value={s.occupiedSlots}  tone="slate" />
      <Stat label="Maintenance"  value={s.maintenanceSlots} tone="red" />
      <Stat label="Registered users" value={s.totalUsers} />
      <Stat label="Active reservations" value={s.activeReservations} />
      <Stat label="Total revenue" value={`Rs ${Number(s.totalRevenue).toFixed(0)}`} tone="emerald" />
    </div>
  );
}

/* ─────────────── Slots CRUD ─────────────── */
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
      <div className="flex justify-end mb-4">
        <button onClick={() => setAdding(true)} className="btn btn-primary">Add slot</button>
      </div>
      {err && <ErrorBox msg={err} />}
      <Table headers={["Number", "Location", "Type", "Status", ""]}>
        {rows.map((s) => (
          <tr key={s.slotId} className="border-t border-white/5">
            <Td bold>{s.slotNumber}</Td>
            <Td>{s.location}</Td>
            <Td muted>{s.type}</Td>
            <Td><Badge status={s.status} /></Td>
            <Td align="right">
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditing(s)} className="btn btn-secondary text-xs px-3 py-1.5">Edit</button>
                <button onClick={() => remove(s.slotId)} className="btn btn-danger text-xs px-3 py-1.5">Delete</button>
              </div>
            </Td>
          </tr>
        ))}
      </Table>

      {adding && <SlotModal uid={uid} onClose={() => setAdding(false)} onSaved={async () => { setAdding(false); await load(); }} />}
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
      <div className="card max-w-md w-full p-6 fade-in">
        <h3 className="text-xl font-bold">{isEdit ? "Edit slot" : "Add slot"}</h3>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label className="label">Slot number</label>
            <input className="input font-mono" value={form.slotNumber} onChange={change("slotNumber")} disabled={isEdit} placeholder="A1" required />
          </div>
          <div>
            <label className="label">Location</label>
            <input className="input" value={form.slotLocation} onChange={change("slotLocation")} placeholder="Ground Floor" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.slotType} onChange={change("slotType")}>
                <option>Car</option><option>Bike</option><option>EV</option>
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={change("status")}>
                <option>Available</option><option>Reserved</option><option>Occupied</option><option>Maintenance</option>
              </select>
            </div>
          </div>
          {err && <ErrorBox msg={err} />}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-1">
              {loading ? "Saving…" : (isEdit ? "Save changes" : "Add slot")}
            </button>
          </div>
        </form>
      </div>
    </Backdrop>
  );
}

/* ─────────────── Pricing ─────────────── */
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
      <div className="flex justify-end mb-4">
        <button onClick={() => setAdding(true)} className="btn btn-primary">Add rule</button>
      </div>
      {err && <ErrorBox msg={err} />}
      <Table headers={["Type", "Price/hr", "Effective from", ""]}>
        {rows.map((p) => (
          <tr key={p.pricingId} className="border-t border-white/5">
            <Td bold>{p.type}</Td>
            <Td>Rs {Number(p.pricePerHour).toFixed(2)}</Td>
            <Td muted>{p.effectiveFrom}</Td>
            <Td align="right">
              <button onClick={() => remove(p.pricingId)} className="btn btn-danger text-xs px-3 py-1.5">Delete</button>
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
      <div className="card max-w-md w-full p-6 fade-in">
        <h3 className="text-xl font-bold">Add pricing rule</h3>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.slotType} onChange={change("slotType")}>
              <option>Car</option><option>Bike</option><option>EV</option>
            </select>
          </div>
          <div>
            <label className="label">Price per hour (Rs)</label>
            <input className="input" type="number" step="0.01" value={form.pricePerHour} onChange={change("pricePerHour")} placeholder="100" required />
          </div>
          <div>
            <label className="label">Effective from</label>
            <input className="input" type="date" value={form.effectiveFrom} onChange={change("effectiveFrom")} required />
          </div>
          {err && <ErrorBox msg={err} />}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-1">
              {loading ? "Saving…" : "Add rule"}
            </button>
          </div>
        </form>
      </div>
    </Backdrop>
  );
}

/* ─────────────── Reservations / Payments / Users (read-only) ─────────────── */
function ReservationsPanel({ uid }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  useEffect(() => { api.adminReservations(uid).then(setRows).catch((e) => setErr(e.message)); }, [uid]);
  return (
    <>
      {err && <ErrorBox msg={err} />}
      {rows.length === 0 && !err ? (
        <Empty title="No reservations" />
      ) : (
        <Table headers={["Slot", "User", "Vehicle", "Start", "End", "Status", "Code"]}>
          {rows.map((r) => (
            <tr key={r.reservationId} className="border-t border-white/5">
              <Td bold>{r.slotNumber}</Td>
              <Td>
                <div>{r.userName}</div>
                <div className="text-xs text-slate-500">{r.userEmail}</div>
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
      {err && <ErrorBox msg={err} />}
      {rows.length === 0 && !err ? (
        <Empty title="No payments yet" />
      ) : (
        <Table headers={["User", "Amount", "Method", "Status", "Date"]}>
          {rows.map((p) => (
            <tr key={p.paymentId} className="border-t border-white/5">
              <Td>{p.userName}</Td>
              <Td bold>Rs {Number(p.amount).toFixed(2)}</Td>
              <Td>{p.method}</Td>
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
      {err && <ErrorBox msg={err} />}
      <Table headers={["Name", "Email", "Phone", "Role", "Joined"]}>
        {rows.map((u) => (
          <tr key={u.userId} className="border-t border-white/5">
            <Td bold>{u.fullName}</Td>
            <Td>{u.email}</Td>
            <Td mono>{u.phone}</Td>
            <Td><Badge status={u.role === "Admin" ? "Reserved" : "Available"} />{" "}<span className="text-xs text-slate-400">{u.role}</span></Td>
            <Td muted>{u.registrationDate}</Td>
          </tr>
        ))}
      </Table>
    </>
  );
}

/* ─────────────── Helpers ─────────────── */
function Stat({ label, value, tone = "default" }) {
  const colors = {
    emerald: "text-emerald-400",
    amber:   "text-amber-400",
    red:     "text-red-400",
    slate:   "text-slate-400",
    default: "text-slate-100",
  };
  return (
    <div className="card p-5">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${colors[tone]}`}>{value}</div>
    </div>
  );
}

function Table({ headers, children }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.02] text-slate-400 text-xs">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className={`px-4 py-3 font-medium ${i === headers.length - 1 ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
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

function ErrorBox({ msg }) {
  return <div className="mb-4 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{msg}</div>;
}

function fmt(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
