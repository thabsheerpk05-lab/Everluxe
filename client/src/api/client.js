export const API_BASE = (import.meta.env.VITE_API_BASE || "/api").replace(/\/$/, "");
// Uploaded media is served by the API host, not by the static Vercel site.
// Set VITE_MEDIA_BASE in deployments; absolute API bases are also supported.
export const MEDIA_BASE = (import.meta.env.VITE_MEDIA_BASE || (API_BASE.startsWith("http") ? API_BASE.replace(/\/api$/, "") : "")).replace(/\/$/, "");

export function assetUrl(url) {
  if (!url?.startsWith("/") || url.startsWith("/brand/")) return url;
  return `${MEDIA_BASE}${url}`;
}

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    if (response.status === 401) {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      window.dispatchEvent(new Event("auth:unauthorized"));
    }
    throw new Error(error.message || "Request failed");
  }

  if (response.status === 204) {
    return null;
  }
  return response.json();
}
