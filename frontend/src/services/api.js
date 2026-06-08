const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:10000";

function toUrl(path) {
  return API_BASE.replace(/\/$/, "") + path;
}

/* ---------------- SESSION ---------------- */
export async function apiCreateOrResumeSession({ language, mode }) {
  const res = await fetch(toUrl("/api/session/createOrResume"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language, mode }),
  });

  if (!res.ok) throw new Error("Failed to create session");
  return res.json();
}

/* ---------------- MENU ---------------- */
export async function apiGetMenu() {
  const res = await fetch(toUrl("/api/menu"));

  if (!res.ok) throw new Error("Failed to get menu");
  return res.json();
}

/* ---------------- ORDER CONFIRM ---------------- */
export async function apiConfirmOrder({ sessionId, cartItems }) {
  const res = await fetch(toUrl("/api/order/confirm"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, cartItems }),
  });

  if (!res.ok) throw new Error("Failed to confirm order");
  return res.json();
}

/* ---------------- KITCHEN SEND ---------------- */
export async function apiKitchenSend({ orderId }) {
  const res = await fetch(toUrl("/api/kitchen/send"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
  });

  if (!res.ok) throw new Error("Failed to send to kitchen");
  return res.json();
}

/* ---------------- KITCHEN ORDERS ---------------- */
export async function apiKitchenGetOrders() {
  const res = await fetch(toUrl("/api/kitchen/orders"));

  if (!res.ok) throw new Error("Failed to get kitchen orders");
  return res.json();
}

/* ---------------- ORDER STATUS ---------------- */
export async function apiOrderStatus(orderId) {
  const res = await fetch(
    toUrl(`/api/order/${encodeURIComponent(orderId)}`)
  );

  if (!res.ok) throw new Error("Failed to fetch order");
  return res.json();
}

/* ---------------- PAYMENT ---------------- */
export async function apiPayDummy({ orderId }) {
  const res = await fetch(toUrl("/api/payment/dummy"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
  });

  if (!res.ok) throw new Error("Payment failed");
  return res.json();
}