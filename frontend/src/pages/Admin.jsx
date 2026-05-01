import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, getSession } from "../api";
import Shell, { Hero, Cream, Empty, Badge, ErrorBox } from "../components/Shell";
import { Backdrop } from "../components/BookingModal";

const TABS = ["OVERVIEW", "SLOTS", "PRICING", "PEAK HOURS", "CHECK-IN", "RESERVATIONS", "EXTENSIONS", "PAYMENTS", "USERS", "REPORTS"];

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

        {tab === "OVERVIEW"     && <Overview         uid={user.userId} />}
        {tab === "SLOTS"        && <SlotsPanel       uid={user.userId} />}
        {tab === "PRICING"      && <PricingPanel     uid={user.userId} />}
        {tab === "PEAK HOURS"   && <PeakHoursPanel   uid={user.userId} />}
        {tab === "CHECK-IN"     && <CheckInPanel     uid={user.userId} />}
        {tab === "RESERVATIONS" && <ReservationsPanel uid={user.userId} />}
        {tab === "EXTENSIONS"   && <ExtensionsPanel   uid={user.userId} />}
        {tab === "PAYMENTS"     && <PaymentsPanel    uid={user.userId} />}
        {tab === "USERS"        && <UsersPanel       uid={user.userId} />}
        {tab === "REPORTS"      && <ReportsPanel     uid={user.userId} />}
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
  const [addingLane, setAddingLane] = useState(false);
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
      <div className="flex justify-end gap-2 mb-6">
        <button onClick={() => setAddingLane(true)} className="btn-sweep bg-white/40 hover:bg-white/60 text-[#1e2d44] text-xs font-black tracking-[0.25em] px-5 py-3 border border-[#1e2d44]/15">
          + ADD LANE
        </button>
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
            <Td>
              <Badge status={s.status} />
              {s.freeAt && s.status !== "Available" && s.status !== "Maintenance" && (
                <div className="text-[10px] text-[#1e2d44]/60 mt-1">
                  free in {fmtFreeIn(s.freeAt)} <span className="text-[#1e2d44]/40">· {fmt(s.freeAt)}</span>
                </div>
              )}
            </Td>
            <Td align="right">
              <div className="flex justify-end gap-2 whitespace-nowrap">
                <button onClick={() => setEditing(s)} className="text-[10px] tracking-widest font-bold border border-[#1e2d44]/30 hover:bg-[#1e2d44]/10 text-[#1e2d44] px-3 py-1.5">EDIT</button>
                <button onClick={() => remove(s.slotId)} className="text-[10px] tracking-widest font-bold bg-red-700/90 hover:bg-red-700 text-white px-3 py-1.5">DELETE</button>
              </div>
            </Td>
          </tr>
        ))}
      </Table>

      {adding     && <SlotModal uid={uid} onClose={() => setAdding(false)}  onSaved={async () => { setAdding(false);  await load(); }} />}
      {addingLane && <LaneModal uid={uid} onClose={() => setAddingLane(false)} onSaved={async () => { setAddingLane(false); await load(); }} />}
      {editing    && <SlotModal uid={uid} slot={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />}
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
    laneId: "",
  });
  const [allSlots, setAllSlots] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.slots().then(setAllSlots).catch(() => {}); }, []);

  // Locations & lanes derived from existing slots
  const locations = Array.from(new Set(allSlots.map((s) => s.location))).sort();
  const lanesInLoc = (loc) => {
    const map = new Map();
    for (const s of allSlots) {
      if (s.location !== loc || s.laneId == null) continue;
      if (!map.has(s.laneId)) map.set(s.laneId, { laneId: s.laneId, type: s.type, count: 0 });
      map.get(s.laneId).count++;
    }
    return Array.from(map.values()).sort((a, b) => a.laneId - b.laneId);
  };
  const lanes = lanesInLoc(form.slotLocation);
  const selectedLane = lanes.find((l) => String(l.laneId) === String(form.laneId));

  const change = (k) => (e) => {
    const v = e.target.value;
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === "slotLocation") next.laneId = "";  // reset lane on location change
      if (k === "laneId" && v) {
        const l = lanesInLoc(next.slotLocation).find((x) => String(x.laneId) === v);
        if (l) next.slotType = l.type;             // force type to match lane
      }
      return next;
    });
  };

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
        const body = { ...form };
        if (body.laneId === "") delete body.laneId; else body.laneId = Number(body.laneId);
        await api.adminCreateSlot(uid, body);
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
          <DarkLocationField
            label="LOCATION"
            value={form.slotLocation}
            onChange={change("slotLocation")}
            options={locations}
          />
          {!isEdit && lanes.length > 0 && (
            <div>
              <label className="block text-[10px] tracking-[0.3em] text-slate-400 mb-2 font-bold">LANE (OPTIONAL)</label>
              <select
                value={form.laneId}
                onChange={change("laneId")}
                className="input-lift w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/60"
              >
                <option value="">— New lane (auto) —</option>
                {lanes.map((l) => (
                  <option key={l.laneId} value={l.laneId}>
                    Lane {l.laneId} · {l.type} · {l.count} slots
                  </option>
                ))}
              </select>
              {selectedLane && (
                <p className="text-[10px] text-slate-500 mt-1">
                  Type locked to <span className="text-white font-bold">{selectedLane.type}</span> for this lane.
                </p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] tracking-[0.3em] text-slate-400 mb-2 font-bold">TYPE</label>
              <select
                value={form.slotType}
                onChange={change("slotType")}
                disabled={!!selectedLane}
                className="input-lift w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/60 disabled:opacity-50"
              >
                {["Car", "Bike", "EBike", "EV"].map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
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

function DarkLocationField({ label, value, onChange, options }) {
  const [creating, setCreating] = useState(false);
  return (
    <div>
      <label className="block text-[10px] tracking-[0.3em] text-slate-400 mb-2 font-bold">{label}</label>
      {creating || options.length === 0 ? (
        <div className="flex gap-2">
          <input
            value={value}
            onChange={onChange}
            placeholder="New location name"
            autoFocus
            className="input-lift flex-1 bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/60"
          />
          {options.length > 0 && (
            <button type="button" onClick={() => setCreating(false)} className="text-[10px] tracking-widest font-bold bg-white/5 hover:bg-white/10 text-slate-300 px-3 rounded-lg">PICK</button>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <select
            value={value}
            onChange={onChange}
            className="input-lift flex-1 bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/60"
          >
            <option value="">— Pick a location —</option>
            {options.map((o) => <option key={o}>{o}</option>)}
          </select>
          <button type="button" onClick={() => { setCreating(true); onChange({ target: { value: "" } }); }} className="text-[10px] tracking-widest font-bold bg-white/5 hover:bg-white/10 text-slate-300 px-3 rounded-lg">+ NEW</button>
        </div>
      )}
    </div>
  );
}

function LaneModal({ uid, onClose, onSaved }) {
  const [form, setForm] = useState({
    slotLocation: "", slotType: "Car", prefix: "L", count: 5,
  });
  const [allSlots, setAllSlots] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const change = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  useEffect(() => { api.slots().then(setAllSlots).catch(() => {}); }, []);
  const locations = Array.from(new Set(allSlots.map((s) => s.location))).sort();

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const count = Number(form.count);
      if (!form.slotLocation.trim()) throw new Error("Location is required");
      if (!form.prefix.trim()) throw new Error("Prefix is required");
      if (count < 1 || count > 30) throw new Error("Count must be 1-30");
      await api.adminCreateLane(uid, {
        slotLocation: form.slotLocation,
        slotType: form.slotType,
        prefix: form.prefix.trim(),
        count,
      });
      onSaved();
    } catch (e2) { setErr(e2.message); }
    finally { setLoading(false); }
  };

  return (
    <Backdrop onClose={onClose}>
      <div className="bg-[#1e2d44] text-white border border-white/10 rounded-2xl max-w-md w-full p-6 anim-fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="text-[10px] tracking-[0.4em] text-slate-400 mb-1 font-bold">CREATE</div>
        <h3 className="text-3xl font-black mb-1">NEW LANE</h3>
        <p className="text-xs text-slate-400 tracking-wide mb-5">
          Bulk-create up to 30 slots in one go. Slot numbers auto-generated as PREFIX1, PREFIX2…
        </p>
        <form onSubmit={submit} className="space-y-4">
          <DarkLocationField label="LOCATION" value={form.slotLocation} onChange={change("slotLocation")} options={locations} />
          <div className="grid grid-cols-2 gap-3">
            <DarkField label="PREFIX" value={form.prefix} onChange={change("prefix")} placeholder="B" mono />
            <DarkField label="COUNT (1-30)" value={form.count} onChange={change("count")} type="number" />
          </div>
          <DarkSelect label="TYPE" value={form.slotType} onChange={change("slotType")} options={["Car", "Bike", "EBike", "EV"]} />
          {err && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</div>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 font-semibold py-3 rounded-lg transition">Cancel</button>
            <button type="submit" disabled={loading} className="btn-sweep flex-1 bg-[#cabf9e] hover:bg-[#b6a880] disabled:opacity-40 text-[#1e2d44] font-black tracking-[0.2em] py-3 rounded-lg">
              {loading ? "CREATING…" : `ADD ${form.count} SLOTS →`}
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
          <DarkSelect label="TYPE" value={form.slotType} onChange={change("slotType")} options={["Car", "Bike", "EBike", "EV"]} />
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

  const load = async () => {
    try { setRows(await api.adminReservations(uid)); }
    catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, [uid]);

  const forceCancel = async (id) => {
    if (!confirm("Force-cancel this reservation? This bypasses the user's 1-hour rule.")) return;
    try { await api.adminForceCancel(uid, id); await load(); }
    catch (e) { setErr(e.message); }
  };

  return (
    <>
      <ErrorBox msg={err} onLight />
      {!err && rows.length === 0 ? (
        <Empty title="No reservations yet" />
      ) : (
        <Table headers={["SLOT", "USER", "VEHICLE", "WINDOW", "CHECK-IN/OUT", "STATUS", "CODE", ""]}>
          {rows.map((r) => (
            <tr key={r.reservationId} className="border-t border-[#1e2d44]/15">
              <Td bold>{r.slotNumber}</Td>
              <Td>
                <div className="font-semibold">{r.userName}</div>
                <div className="text-[11px] text-[#1e2d44]/60">{r.userEmail}</div>
              </Td>
              <Td mono>{r.licensePlate}</Td>
              <Td>
                <div className="text-xs">{fmt(r.startTime)}</div>
                <div className="text-[11px] text-[#1e2d44]/60">→ {fmt(r.endTime)}</div>
              </Td>
              <Td>
                <div className="text-[11px] text-[#1e2d44]/70">
                  {r.checkInTime ? `IN ${fmt(r.checkInTime)}` : "—"}
                </div>
                <div className="text-[11px] text-[#1e2d44]/70">
                  {r.checkOutTime ? `OUT ${fmt(r.checkOutTime)}` : ""}
                </div>
              </Td>
              <Td><Badge status={r.status} /></Td>
              <Td mono>{r.verificationCode}</Td>
              <Td align="right">
                {r.status === "Booked" && (
                  <button onClick={() => forceCancel(r.reservationId)} className="text-[10px] tracking-widest font-bold bg-red-700/90 hover:bg-red-700 text-white px-3 py-1.5 whitespace-nowrap">
                    FORCE CANCEL
                  </button>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}

/* ─────────────── EXTENSION REQUESTS ─────────────── */
function ExtensionsPanel({ uid }) {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("Pending");
  const [err, setErr] = useState("");

  const load = async () => {
    try { setRows(await api.adminExtensions(uid, filter || undefined)); }
    catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, [uid, filter]);

  const approve = async (id) => {
    const note = prompt("Optional note for the user:") || "";
    try { await api.adminApproveExtension(uid, id, { adminNote: note }); await load(); }
    catch (e) { setErr(e.message); }
  };
  const deny = async (id) => {
    const note = prompt("Reason (optional):") || "";
    try { await api.adminDenyExtension(uid, id, { adminNote: note }); await load(); }
    catch (e) { setErr(e.message); }
  };

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {["Pending", "Approved", "Denied", ""].map((f) => (
          <button
            key={f || "all"}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-[10px] font-black tracking-[0.25em] transition ${
              filter === f ? "bg-[#1e2d44] text-white" : "bg-white/40 text-[#1e2d44] hover:bg-white/60"
            }`}
          >
            {f.toUpperCase() || "ALL"}
          </button>
        ))}
      </div>

      <ErrorBox msg={err} onLight />
      {!err && rows.length === 0 ? (
        <Empty title="No extension requests" />
      ) : (
        <Table headers={["SLOT", "USER", "CURRENT END", "REQUESTED END", "NOTE", "STATUS", ""]}>
          {rows.map((r) => (
            <tr key={r.extensionRequestId} className="border-t border-[#1e2d44]/15">
              <Td bold>{r.slotNumber}</Td>
              <Td>
                <div className="font-semibold">{r.userName}</div>
                <div className="text-[11px] text-[#1e2d44]/60">{r.userEmail}</div>
              </Td>
              <Td mono>{fmt(r.reservationEnd)}</Td>
              <Td mono>{fmt(r.requestedEndTime)}</Td>
              <Td>
                <div className="text-xs italic text-[#1e2d44]/70 max-w-xs">
                  {r.userNote || "—"}
                </div>
                {r.adminNote && (
                  <div className="text-[10px] text-[#1e2d44]/50 mt-1">admin: {r.adminNote}</div>
                )}
              </Td>
              <Td><Badge status={r.status} /></Td>
              <Td align="right">
                {r.status === "Pending" ? (
                  <div className="flex justify-end gap-2 whitespace-nowrap">
                    <button onClick={() => approve(r.extensionRequestId)} className="text-[10px] tracking-widest font-bold bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5">APPROVE</button>
                    <button onClick={() => deny(r.extensionRequestId)} className="text-[10px] tracking-widest font-bold bg-red-700/90 hover:bg-red-700 text-white px-3 py-1.5">DENY</button>
                  </div>
                ) : (
                  <span className="text-[10px] text-[#1e2d44]/50">{fmt(r.resolvedAt)}</span>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
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

/* ─────────────── PEAK HOURS ─────────────── */
function PeakHoursPanel({ uid }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    try { setRows(await api.adminPeakHours(uid)); } catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!confirm("Delete this peak hour rule?")) return;
    try { await api.adminDeletePeakHour(uid, id); await load(); }
    catch (e) { setErr(e.message); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <p className="text-xs text-[#1e2d44]/60 tracking-wider max-w-xl">
          Multipliers applied to base hourly rate. Hours not covered by any rule charge at 1.0×.
        </p>
        <button onClick={() => setAdding(true)} className="btn-sweep bg-[#1e2d44] hover:bg-[#2a3b52] text-white text-xs font-black tracking-[0.25em] px-5 py-3">
          + ADD RULE
        </button>
      </div>
      <ErrorBox msg={err} onLight />
      <Table headers={["LABEL", "HOUR RANGE", "MULTIPLIER", ""]}>
        {rows.map((p) => (
          <tr key={p.peakHourId} className="border-t border-[#1e2d44]/15">
            <Td bold>{p.label}</Td>
            <Td mono>{String(p.startHour).padStart(2, "0")}:00 — {String(p.endHour).padStart(2, "0")}:00</Td>
            <Td mono>×{Number(p.multiplier).toFixed(2)}</Td>
            <Td align="right">
              <button onClick={() => remove(p.peakHourId)} className="text-[10px] tracking-widest font-bold bg-red-700/90 hover:bg-red-700 text-white px-3 py-1.5">DELETE</button>
            </Td>
          </tr>
        ))}
      </Table>
      {adding && <PeakHourModal uid={uid} onClose={() => setAdding(false)} onSaved={async () => { setAdding(false); await load(); }} />}
    </div>
  );
}

function PeakHourModal({ uid, onClose, onSaved }) {
  const [form, setForm] = useState({ label: "", startHour: 8, endHour: 10, multiplier: 1.5 });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const change = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const startHour = Number(form.startHour);
      const endHour = Number(form.endHour);
      const multiplier = Number(form.multiplier);
      if (!form.label.trim()) throw new Error("Label is required");
      if (endHour <= startHour) throw new Error("End hour must be after start hour");
      if (multiplier <= 0) throw new Error("Multiplier must be > 0");
      await api.adminCreatePeakHour(uid, { label: form.label, startHour, endHour, multiplier });
      onSaved();
    } catch (e2) { setErr(e2.message); }
    finally { setLoading(false); }
  };

  return (
    <Backdrop onClose={onClose}>
      <div className="bg-[#1e2d44] text-white border border-white/10 rounded-2xl max-w-md w-full p-6 anim-fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="text-[10px] tracking-[0.4em] text-slate-400 mb-1 font-bold">CREATE</div>
        <h3 className="text-3xl font-black mb-5">PEAK HOUR RULE</h3>
        <form onSubmit={submit} className="space-y-4">
          <DarkField label="LABEL" value={form.label} onChange={change("label")} placeholder="Morning Rush" />
          <div className="grid grid-cols-2 gap-3">
            <DarkField label="START HOUR (0-23)" value={form.startHour} onChange={change("startHour")} type="number" />
            <DarkField label="END HOUR (1-24)" value={form.endHour} onChange={change("endHour")} type="number" />
          </div>
          <DarkField label="MULTIPLIER (e.g. 1.5)" value={form.multiplier} onChange={change("multiplier")} type="number" />
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

/* ─────────────── CHECK-IN OPERATOR ─────────────── */
function CheckInPanel({ uid }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setLast(null); setBusy(true);
    try {
      const r = await api.checkInReservation(code.trim().toUpperCase());
      setLast(r);
      setCode("");
    } catch (e2) { setErr(e2.message); }
    finally { setBusy(false); }
  };

  const checkOutById = async (id) => {
    setErr("");
    try {
      const r = await api.checkOutReservation(id, uid);
      setLast({ ...r, mode: "checkout" });
    } catch (e2) { setErr(e2.message); }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <p className="text-xs text-[#1e2d44]/60 tracking-wider mb-6">
        Operator station — scan or type the verification code shown on the user's booking.
      </p>
      <form onSubmit={submit} className="bg-[#1e2d44] text-white p-6 rounded-2xl mb-6">
        <label className="block text-[10px] tracking-[0.3em] text-slate-400 mb-2 font-bold">VERIFICATION CODE</label>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="A1B2C3"
            autoFocus
            className="flex-1 bg-white/5 border border-white/15 rounded-lg px-4 py-4 text-2xl font-mono tracking-[0.3em] text-center focus:outline-none focus:border-white/60"
          />
          <button type="submit" disabled={busy || !code} className="btn-sweep bg-[#cabf9e] hover:bg-[#b6a880] disabled:opacity-40 text-[#1e2d44] font-black tracking-[0.2em] px-6 rounded-lg">
            {busy ? "…" : "CHECK IN →"}
          </button>
        </div>
      </form>

      <ErrorBox msg={err} onLight />

      {last && last.mode !== "checkout" && (
        <div className="bg-emerald-50 border border-emerald-700/30 p-5 mb-6">
          <div className="text-[10px] tracking-[0.4em] text-emerald-700 font-bold mb-2">CHECKED IN</div>
          <div className="font-black text-xl text-[#1e2d44]">{last.userName}</div>
          <div className="text-sm text-[#1e2d44]/70">Slot {last.slotNumber} · Reservation #{last.reservationId}</div>
          <button onClick={() => checkOutById(last.reservationId)} className="mt-3 text-[10px] tracking-widest font-bold bg-amber-700 hover:bg-amber-800 text-white px-4 py-2">
            CHECK OUT NOW
          </button>
        </div>
      )}
      {last && last.mode === "checkout" && (
        <div className="bg-amber-50 border border-amber-700/30 p-5">
          <div className="text-[10px] tracking-[0.4em] text-amber-700 font-bold mb-2">CHECKED OUT</div>
          <div className="font-black text-xl text-[#1e2d44]">Reservation #{last.reservationId}</div>
          <div className="text-sm text-[#1e2d44]/70">Final amount: Rs {Number(last.finalAmount || 0).toFixed(2)}</div>
        </div>
      )}
    </div>
  );
}

/* ─────────────── REPORTS ─────────────── */
function ReportsPanel({ uid }) {
  const [revenue, setRevenue] = useState([]);
  const [hours, setHours] = useState([]);
  const [top, setTop] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    Promise.all([
      api.adminRevenueByLocation(uid),
      api.adminPeakHoursReport(uid),
      api.adminTopUsers(uid),
    ]).then(([r, h, t]) => { setRevenue(r); setHours(h); setTop(t); })
      .catch((e) => setErr(e.message));
  }, [uid]);

  const maxBookings = Math.max(1, ...hours.map((h) => h.bookings));

  return (
    <div className="space-y-10">
      <ErrorBox msg={err} onLight />

      <section>
        <h4 className="text-xs tracking-[0.3em] font-black mb-4 text-[#1e2d44]">REVENUE BY LOCATION</h4>
        {revenue.length === 0 ? <Empty title="No revenue data yet" /> : (
          <Table headers={["LOCATION", "RESERVATIONS", "REVENUE"]}>
            {revenue.map((r) => (
              <tr key={r.location} className="border-t border-[#1e2d44]/15">
                <Td bold>{r.location}</Td>
                <Td mono>{r.reservations}</Td>
                <Td bold>Rs {Number(r.revenue).toFixed(2)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section>
        <h4 className="text-xs tracking-[0.3em] font-black mb-4 text-[#1e2d44]">BOOKINGS BY HOUR OF DAY</h4>
        {hours.length === 0 ? <Empty title="No bookings yet" /> : (
          <div className="bg-white/20 border border-[#1e2d44]/30 p-5">
            <div className="grid grid-cols-12 gap-1 items-end h-40">
              {Array.from({ length: 24 }).map((_, h) => {
                const row = hours.find((x) => x.hour === h);
                const n = row?.bookings || 0;
                return (
                  <div key={h} className="flex flex-col items-center justify-end col-span-1" title={`${h}:00 — ${n} bookings`}>
                    <div
                      className="w-full bg-[#1e2d44]"
                      style={{ height: `${(n / maxBookings) * 100}%`, minHeight: n ? "4px" : "0" }}
                    />
                    <div className="text-[9px] tracking-widest text-[#1e2d44]/60 mt-1">{String(h).padStart(2, "0")}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section>
        <h4 className="text-xs tracking-[0.3em] font-black mb-4 text-[#1e2d44]">TOP USERS</h4>
        {top.length === 0 ? <Empty title="No users yet" /> : (
          <Table headers={["NAME", "EMAIL", "BOOKINGS", "TOTAL SPENT"]}>
            {top.map((u) => (
              <tr key={u.userId} className="border-t border-[#1e2d44]/15">
                <Td bold>{u.fullName}</Td>
                <Td>{u.email}</Td>
                <Td mono>{u.totalReservations}</Td>
                <Td bold>Rs {Number(u.totalSpent).toFixed(2)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
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

function fmt(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
