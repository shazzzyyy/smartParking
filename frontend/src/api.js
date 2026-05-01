const BASE = "http://localhost:8080/api";

async function req(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // auth
  register: (body) => req("/auth/register", { method: "POST", body }),
  login:    (body) => req("/auth/login",    { method: "POST", body }),

  // slots / pricing
  slots:     (location) => req(`/slots${location ? `?location=${encodeURIComponent(location)}` : ""}`),
  locations: ()         => req("/slots/locations"),
  pricing:   ()         => req("/slots/pricing"),
  peakHours: ()         => req("/slots/peak-hours"),
  quote:     ({ slotType, start, end }) =>
    req(`/slots/quote?slotType=${slotType}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),

  // vehicles
  myVehicles:    (userId)     => req(`/vehicles/mine?userId=${userId}`),
  addVehicle:    (body)       => req("/vehicles", { method: "POST", body }),
  deleteVehicle: (id, userId) => req(`/vehicles/${id}?userId=${userId}`, { method: "DELETE" }),

  // reservations
  createReservation:   (body)       => req("/reservations", { method: "POST", body }),
  myReservations:      (userId)     => req(`/reservations/mine?userId=${userId}`),
  cancelReservation:   (id, userId) => req(`/reservations/${id}/cancel?userId=${userId}`, { method: "PATCH" }),
  checkInReservation:  (code)       => req("/reservations/checkin", { method: "POST", body: { code } }),
  checkOutReservation: (id, userId) => req(`/reservations/${id}/checkout?userId=${userId}`, { method: "POST" }),

  // extensions (user)
  requestExtension:    (id, body)         => req(`/reservations/${id}/extensions`, { method: "POST", body }),
  myExtensions:        (id, userId)       => req(`/reservations/${id}/extensions?userId=${userId}`),

  // payments
  pay:        (body)   => req("/payments", { method: "POST", body }),
  myPayments: (userId) => req(`/payments/mine?userId=${userId}`),

  // admin
  adminStats:         (uid)        => req(`/admin/stats?userId=${uid}`),
  adminUsers:         (uid)        => req(`/admin/users?userId=${uid}`),
  adminReservations:  (uid)        => req(`/admin/reservations?userId=${uid}`),
  adminPayments:      (uid)        => req(`/admin/payments?userId=${uid}`),
  adminPricing:       (uid)        => req(`/admin/pricing?userId=${uid}`),
  adminCreateSlot:    (uid, body)  => req(`/admin/slots?userId=${uid}`, { method: "POST", body }),
  adminCreateLane:    (uid, body)  => req(`/admin/slots/bulk?userId=${uid}`, { method: "POST", body }),
  adminUpdateSlot:    (uid, id, b) => req(`/admin/slots/${id}?userId=${uid}`, { method: "PATCH", body: b }),
  adminDeleteSlot:    (uid, id)    => req(`/admin/slots/${id}?userId=${uid}`, { method: "DELETE" }),
  adminCreatePricing: (uid, body)  => req(`/admin/pricing?userId=${uid}`, { method: "POST", body }),
  adminDeletePricing: (uid, id)    => req(`/admin/pricing/${id}?userId=${uid}`, { method: "DELETE" }),

  // admin — peak hours
  adminPeakHours:       (uid)       => req(`/admin/peak-hours?userId=${uid}`),
  adminCreatePeakHour:  (uid, body) => req(`/admin/peak-hours?userId=${uid}`, { method: "POST", body }),
  adminDeletePeakHour:  (uid, id)   => req(`/admin/peak-hours/${id}?userId=${uid}`, { method: "DELETE" }),

  // admin — reports
  adminRevenueByLocation: (uid) => req(`/admin/reports/revenue-by-location?userId=${uid}`),
  adminPeakHoursReport:   (uid) => req(`/admin/reports/peak-hours?userId=${uid}`),
  adminTopUsers:          (uid) => req(`/admin/reports/top-users?userId=${uid}`),

  // admin — force cancel & extensions
  adminForceCancel:       (uid, id)       => req(`/admin/reservations/${id}/cancel?userId=${uid}`, { method: "PATCH" }),
  adminExtensions:        (uid, status)   => req(`/admin/extensions?userId=${uid}${status ? `&status=${status}` : ""}`),
  adminApproveExtension:  (uid, id, body) => req(`/admin/extensions/${id}/approve?userId=${uid}`, { method: "POST", body: body || {} }),
  adminDenyExtension:     (uid, id, body) => req(`/admin/extensions/${id}/deny?userId=${uid}`, { method: "POST", body: body || {} }),
};

export function getSession() {
  try { return JSON.parse(localStorage.getItem("sp_user") || "null"); }
  catch { return null; }
}
export function setSession(u) {
  if (u) localStorage.setItem("sp_user", JSON.stringify(u));
  else localStorage.removeItem("sp_user");
}
