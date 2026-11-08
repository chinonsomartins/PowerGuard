// On your laptop the pages talk to the local API; anywhere else they use the hosted API.
const LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);

export const API_BASE_URL = LOCAL
  ? "https://powerguard-3lr6.onrender.com";

  // : "https://REPLACE-WITH-YOUR-RENDER-URL.onrender.com";