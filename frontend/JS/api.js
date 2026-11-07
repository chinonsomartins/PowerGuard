import { requireUser } from "./session.js";

export const API_BASE_URL = "http://127.0.0.1:8000";

async function call(path, options = {}) {
  const user = await requireUser();
  const token = await user.getIdToken();

  const response = await fetch(API_BASE_URL + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
      ...(options.headers || {}),
    },
  });

  if (response.status === 404 && (options.method || "GET") === "GET")
    return null;

  if (!response.ok) {
    let message = "Request failed (" + response.status + ")";
    try {
      const body = await response.json();
      if (typeof body.detail === "string") message = body.detail;
      else if (Array.isArray(body.detail))
        message = body.detail
          .map((d) => d.loc.slice(1).join(".") + ": " + d.msg)
          .join("; ");
    } catch (error) {
      /* no JSON body */
    }
    throw new Error(message);
  }

  return response.status === 204 ? null : response.json();
}

export const apiGet = (path) => call(path);
export const apiPost = (path, body) =>
  call(path, { method: "POST", body: JSON.stringify(body) });
export const apiPut = (path, body) =>
  call(path, { method: "PUT", body: JSON.stringify(body) });
