const LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);

export const API_BASE_URL = LOCAL
  ? "http://127.0.0.1:8000"
  : "https://powerguard-3lr6.onrender.com";
