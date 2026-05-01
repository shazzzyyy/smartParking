import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, getSession } from "../api";
import Shell, { Hero, Cream, Empty, ErrorBox } from "../components/Shell";
import { Backdrop } from "../components/BookingModal";

export default function Vehicles() {
  const user = getSession();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    try { setVehicles(await api.myVehicles(user.userId)); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    load();
  }, []);

  const remove = async (id) => {
    if (!confirm("Remove this vehicle?")) return;
    try { await api.deleteVehicle(id, user.userId); await load(); }
    catch (e) { setErr(e.message); }
  };

  if (!user) return null;

  return (
    <Shell>
      <Hero
        kicker="GARAGE · REGISTERED · VEHICLES"
        title="VEHICLES"
        subtitle="Cars, bikes, and EVs registered to your account."
      />

      <Cream>
        <div className="flex justify-end mb-6">
          <button
            onClick={() => setAdding(true)}
            className="btn-sweep bg-[#1e2d44] hover:bg-[#2a3b52] text-white text-xs font-black tracking-[0.25em] px-5 py-3"
          >
            + ADD VEHICLE
          </button>
        </div>

        <ErrorBox msg={err} onLight />

        {loading ? (
          <div className="text-center py-20 tracking-widest text-[#1e2d44]/60">LOADING…</div>
        ) : vehicles.length === 0 ? (
          <Empty
            title="No vehicles yet"
            body="Register a vehicle so you can book parking slots."
            action={
              <button onClick={() => setAdding(true)} className="btn-sweep bg-[#1e2d44] hover:bg-[#2a3b52] text-white font-black tracking-[0.2em] px-6 py-3 transition">
                + ADD VEHICLE
              </button>
            }
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {vehicles.map((v) => (
              <div key={v.vehicleId} className="bg-[#1e2d44] text-white border border-[#1e2d44]/20 anim-fade-up">
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] tracking-[0.4em] text-slate-400 font-bold">{v.type.toUpperCase()}</span>
                    <button
                      onClick={() => remove(v.vehicleId)}
                      className="text-[10px] tracking-widest text-slate-500 hover:text-red-300 font-bold"
                    >
                      REMOVE
                    </button>
                  </div>
                  <div className="font-mono text-2xl font-black tracking-wider">{v.licensePlate}</div>
                  <div className="text-sm text-slate-300 mt-2">
                    {v.brand || "—"} {v.model || ""}
                  </div>
                </div>
                {v.color && (
                  <div className="border-t border-white/10 px-5 py-3 bg-[#16202f] text-[10px] tracking-[0.3em] text-slate-500 font-bold">
                    COLOUR · {v.color.toUpperCase()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Cream>

      {adding && (
        <AddModal
          userId={user.userId}
          onClose={() => setAdding(false)}
          onAdded={async () => { setAdding(false); await load(); }}
        />
      )}
    </Shell>
  );
}

function AddModal({ userId, onClose, onAdded }) {
  const [form, setForm] = useState({ licensePlate: "", vehicleType: "Car", brand: "", model: "", color: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const change = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!form.licensePlate.trim()) return setErr("License plate is required");
    setLoading(true);
    try {
      await api.addVehicle({ userId, ...form });
      onAdded();
    } catch (e2) { setErr(e2.message); }
    finally { setLoading(false); }
  };

  return (
    <Backdrop onClose={onClose}>
      <div
        className="bg-[#1e2d44] text-white border border-white/10 rounded-2xl max-w-md w-full p-6 anim-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[10px] tracking-[0.4em] text-slate-400 mb-1 font-bold">REGISTER</div>
        <h3 className="text-3xl font-black mb-5">NEW VEHICLE</h3>

        <form onSubmit={submit} className="space-y-4">
          <Field label="LICENSE PLATE" value={form.licensePlate} onChange={change("licensePlate")} placeholder="LEA-1234" mono required />
          <div>
            <label className="block text-[10px] tracking-[0.3em] text-slate-400 mb-2 font-bold">TYPE</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {["Car", "Bike", "EBike", "EV"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, vehicleType: t })}
                  className={`py-3 text-xs tracking-widest font-bold border transition ${
                    form.vehicleType === t
                      ? "bg-[#cabf9e] border-[#cabf9e] text-[#1e2d44]"
                      : "bg-white/5 border-white/15 text-white hover:bg-white/10"
                  }`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="BRAND" value={form.brand} onChange={change("brand")} placeholder="Toyota" />
            <Field label="MODEL" value={form.model} onChange={change("model")} placeholder="Corolla" />
          </div>
          <Field label="COLOUR" value={form.color} onChange={change("color")} placeholder="White" />

          {err && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</div>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 font-semibold py-3 rounded-lg transition">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-sweep flex-1 bg-[#cabf9e] hover:bg-[#b6a880] disabled:opacity-40 text-[#1e2d44] font-black tracking-[0.2em] py-3 rounded-lg">
              {loading ? "ADDING…" : "ADD VEHICLE →"}
            </button>
          </div>
        </form>
      </div>
    </Backdrop>
  );
}

function Field({ label, value, onChange, placeholder, mono, required }) {
  return (
    <div>
      <label className="block text-[10px] tracking-[0.3em] text-slate-400 mb-2 font-bold">{label}</label>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className={`input-lift w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/60 focus:bg-white/10 ${mono ? "font-mono tracking-widest" : ""}`}
      />
    </div>
  );
}
