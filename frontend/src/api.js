const BASE = "http://localhost:8080/api";

async function req(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  register: (body) => req("/auth/register", { method: "POST", body }),
  login: (body) => req("/auth/login", { method: "POST", body }),

  slots: (location) =>
    req(`/slots${location ? `?location=${encodeURIComponent(location)}` : ""}`),
  locations: () => req("/slots/locations"),
  pricing: () => req("/slots/pricing"),

  myVehicles: (userId) => req(`/vehicles/mine?userId=${userId}`),
  addVehicle: (body) => req("/vehicles", { method: "POST", body }),

  createReservation: (body) => req("/reservations", { method: "POST", body }),
  myReservations: (userId) => req(`/reservations/mine?userId=${userId}`),
  cancelReservation: (id, userId) =>
    req(`/reservations/${id}/cancel?userId=${userId}`, { method: "PATCH" }),

  pay: (body) => req("/payments", { method: "POST", body }),
  myPayments: (userId) => req(`/payments/mine?userId=${userId}`),
};

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem("sp_user") || "null");
  } catch {
    return null;
  }
}
export function setSession(u) {
  if (u) localStorage.setItem("sp_user", JSON.stringify(u));
  else localStorage.removeItem("sp_user");
}
