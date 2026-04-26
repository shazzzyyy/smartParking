import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, getSession } from "../api";
import Shell, { PageHeader, Empty } from "../components/Shell";
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
      <PageHeader
        title="My vehicles"
        subtitle="Vehicles registered to your account."
        action={<button onClick={() => setAdding(true)} className="btn btn-primary">Add vehicle</button>}
      />

      {err && <div className="mb-4 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</div>}

      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">Loading…</div>
      ) : vehicles.length === 0 ? (
        <Empty
          title="No vehicles yet"
          body="Add a vehicle so you can book parking slots."
          action={<button onClick={() => setAdding(true)} className="btn btn-primary">Add vehicle</button>}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map((v) => (
            <div key={v.vehicleId} className="card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-slate-400">{v.type}</div>
                  <div className="font-mono text-lg font-bold mt-0.5">{v.licensePlate}</div>
                  <div className="text-sm text-slate-300 mt-1">
                    {v.brand} {v.model}{v.color ? ` · ${v.color}` : ""}
                  </div>
                </div>
                <button onClick={() => remove(v.vehicleId)} className="text-xs text-slate-500 hover:text-red-400">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && <AddModal onClose={() => setAdding(false)} onAdded={async () => { setAdding(false); await load(); }} userId={user.userId} />}
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
      <div className="card max-w-md w-full p-6 fade-in">
        <h3 className="text-xl font-bold">Add vehicle</h3>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label className="label">License plate</label>
            <input className="input font-mono" value={form.licensePlate} onChange={change("licensePlate")} placeholder="LEA-1234" required />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.vehicleType} onChange={change("vehicleType")}>
              <option>Car</option>
              <option>Bike</option>
              <option>EV</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Brand</label>
              <input className="input" value={form.brand} onChange={change("brand")} placeholder="Toyota" />
            </div>
            <div>
              <label className="label">Model</label>
              <input className="input" value={form.model} onChange={change("model")} placeholder="Corolla" />
            </div>
          </div>
          <div>
            <label className="label">Color</label>
            <input className="input" value={form.color} onChange={change("color")} placeholder="White" />
          </div>
          {err && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</div>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-1">
              {loading ? "Adding…" : "Add vehicle"}
            </button>
          </div>
        </form>
      </div>
    </Backdrop>
  );
}
