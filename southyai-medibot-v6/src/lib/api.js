// Small helper for the staff API. The login cookie is HttpOnly, so the browser sends it automatically.
export async function staffApi(action, payload = {}) {
  const res = await fetch("/api/staff", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, ...payload })
  });
  let data = {};
  try { data = await res.json(); } catch { /* ignore */ }
  if (!res.ok) {
    const e = new Error(data.error || "Something went wrong. Please try again.");
    e.status = res.status;
    throw e;
  }
  return data;
}
