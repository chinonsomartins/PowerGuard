import { requireUser } from "./session.js";
import { API_BASE_URL } from "./api-base.js";

// ==========================================
// POWERGUARD - DASHBOARD (OVERVIEW) JAVASCRIPT
// ==========================================
//
// HOW THIS PAGE WORKS
// 1. loadDashboard() asks fetchDashboardData() for the user's data.
// 2. The page shows ONLY what that data contains. A new user has no
//    records, so every figure is empty (₦0, "—", "No data yet").
// 3. Cards, chart lines and legends only appear for the power sources
//    the user chose on the Business Setup page (grid / generator / battery).
//
// BACKEND DEVELOPER: you only need to edit fetchDashboardData() below.
// The response shape is described in DASHBOARD_API.md.

// ==========================================
// 1. SETTINGS
// ==========================================

const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menuBtn");
const toast = document.getElementById("toast");
const dateRange = document.getElementById("dateRange");

let dashboard = null; // latest data from the backend
let chartPeriod = "weekly"; // weekly | monthly | yearly

// ==========================================
// 2. SMALL HELPERS
// ==========================================

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => toast.classList.remove("show"), 2800);
}

function money(amount) {
  return "₦" + Number(amount || 0).toLocaleString("en-NG");
}

// 25000 -> ₦25k, 1500000 -> ₦1.5M (used on the chart axis)
function moneyShort(amount) {
  if (amount >= 1000000) {
    return "₦" + +(amount / 1000000).toFixed(1) + "M";
  }

  if (amount >= 1000) {
    return "₦" + +(amount / 1000).toFixed(1) + "k";
  }

  return "₦" + Math.round(amount);
}

function escapeHtml(text) {
  return String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
}

function formatDateTime(iso) {
  const date = new Date(iso);

  if (isNaN(date)) {
    return "";
  }

  const day = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const time = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return day + " · " + time;
}

// ==========================================
// 3. USER PROFILE
// ==========================================

// TEMPORARY: reads what the login page saved in the browser.
// The backend can instead send the user inside the dashboard response
// (data.user) - that is used first when it exists.
// The signed-in user comes from Firebase Auth (loaded by requireUser at the end of this file).
let currentUser = null;

function getSavedUser() {
  if (!currentUser) {
    return null;
  }

  return {
    fullName:
      currentUser.displayName || (currentUser.email || "").split("@")[0],
    email: currentUser.email,
  };
}

// Temporary: business setup saved in this tab (Firestore replaces this later).
function getSavedSetup() {
  try {
    return JSON.parse(
      sessionStorage.getItem("powerguardBusinessSetup") || "null",
    );
  } catch (error) {
    return null;
  }
}

// "John Doe" -> "JD"   "Mary Ann Smith" -> "MS"   "Victory" -> "V"
function getInitials(fullName) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "U";
  }

  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";

  return (first + last).toUpperCase();
}

function renderProfile(data) {
  const saved = getSavedUser();
  const setup = getSavedSetup();

  const fullName =
    (data.user && data.user.fullName) || (saved && saved.fullName) || "";

  const business =
    (data.user && data.user.businessName) ||
    (setup && setup.businessName) ||
    "Set up your business";

  document.getElementById("profileName").textContent = fullName || "Your Name";

  document.getElementById("profileAvatar").textContent = fullName
    ? getInitials(fullName)
    : "U";

  document.getElementById("profileBusiness").textContent = business;
}

// ==========================================
// 4. DATA LAYER  (the only part the backend dev must change)
// ==========================================

// A brand-new user: no records at all.
function emptyDashboard() {
  const setup = getSavedSetup();

  return {
    user: null,
    business: {
      powerSources: setup && setup.powerSources ? setup.powerSources : [],
    },
    summary: {
      totalExpenses: { amount: 0, changePercent: null },
      generatorFuel: { amount: 0, changePercent: null },
      gridElectricity: { amount: 0, changePercent: null },
      batteryRuntimeHours: null,
    },
    trend: {
      weekly: { labels: [], total: [], grid: [], generator: [] },
      monthly: { labels: [], total: [], grid: [], generator: [] },
      yearly: { labels: [], total: [], grid: [], generator: [] },
    },
    breakdown: { grid: 0, generator: 0 },
    activity: [],
    insights: {
      generatorCostPerHour: null,
      batteryRuntimeHours: null,
      batteryLoadWatts: null,
      bestOption: null,
    },
  };
}

// range = "7d" | "30d" | "90d"
async function fetchDashboardData(range) {
  // Preview with fake figures: open the page with  ?demo=1
  if (new URLSearchParams(location.search).get("demo") === "1") {
    return sampleDashboard();
  }
  
  const token = await currentUser.getIdToken();

  const response = await fetch(
    `${API_BASE_URL}/api/v1/dashboard?range=${range}`,
    { headers: { Authorization: "Bearer " + token } },
  );
  
  if (!response.ok) {
    throw new Error("Dashboard request failed: " + response.status);
  }
  
  return await response.json();
}

async function loadDashboard(range) {
  try {
    dashboard = await fetchDashboardData(range);
  } catch (error) {
    console.error(error);
    showToast("Could not load your dashboard data. Please try again.");
    dashboard = emptyDashboard();
  }

  renderAll();
}

// ==========================================
// 5. SHOW ONLY THE USER'S POWER SOURCES
// ==========================================

function getSources() {
  return (dashboard.business && dashboard.business.powerSources) || [];
}

function applyPowerSources() {
  const sources = getSources();

  // Hide everything tied to a source the user did not choose
  document.querySelectorAll("[data-source]").forEach((element) => {
    element.hidden = !sources.includes(element.dataset.source);
  });

  // "Best option" compares generator vs inverter, so it needs both
  document.getElementById("insBestRow").hidden = !(
    sources.includes("generator") && sources.includes("battery")
  );

  // Make the summary cards fill the row
  const visibleCards = document.querySelectorAll(
    "#metrics .metric:not([hidden])",
  ).length;

  document
    .getElementById("metrics")
    .style.setProperty("--cols", Math.max(visibleCards, 1));
}

// ==========================================
// 6. SUMMARY CARDS
// ==========================================

function setChange(id, percent) {
  const element = document.getElementById(id);

  element.textContent = "";

  if (percent === null || percent === undefined) {
    element.className = "no-data";
    element.textContent = "No data yet";
    return;
  }

  element.className = "";
  element.textContent = (percent >= 0 ? "↑ " : "↓ ") + Math.abs(percent) + "% ";

  const span = document.createElement("span");
  span.textContent = "from last month";
  element.appendChild(span);
}

function renderMetrics() {
  const s = dashboard.summary || {};

  const total = s.totalExpenses || {};
  const fuel = s.generatorFuel || {};
  const grid = s.gridElectricity || {};

  document.getElementById("totalAmount").textContent = money(total.amount);
  setChange("totalChange", total.changePercent);

  document.getElementById("fuelAmount").textContent = money(fuel.amount);
  setChange("fuelChange", fuel.changePercent);

  document.getElementById("gridAmount").textContent = money(grid.amount);
  setChange("gridChange", grid.changePercent);

  document.getElementById("batteryAmount").textContent = s.batteryRuntimeHours
    ? s.batteryRuntimeHours + " hrs"
    : "—";
}

// ==========================================
// 7. SPENDING TREND CHART
// ==========================================

const CHART_LEFT = 58;
const CHART_RIGHT = 735;
const CHART_TOP = 18;
const CHART_BOTTOM = 194;

// Round the highest value up to a clean axis maximum (e.g. 83,400 -> 100,000)
function niceMax(max) {
  if (max <= 0) {
    return 100000;
  }

  const power = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / power;

  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;

  return nice * power;
}

function pathFrom(xs, ys) {
  return ys
    .map((y, i) => (i === 0 ? "M" : "L") + " " + xs[i] + " " + y)
    .join(" ");
}

function dotsFrom(xs, ys) {
  return ys
    .map((y, i) => `<circle cx="${xs[i]}" cy="${y}" r="4.5"></circle>`)
    .join("");
}

function renderChart() {
  const sources = getSources();
  const data = (dashboard.trend && dashboard.trend[chartPeriod]) || {
    labels: [],
    total: [],
    grid: [],
    generator: [],
  };

  const count = data.labels.length;
  const hasData = count > 0 && data.total.some((value) => value > 0);

  const showGrid = sources.includes("grid");
  const showGen = sources.includes("generator");

  // Highest value that will be drawn
  let max = 0;

  if (hasData) {
    max = Math.max(
      ...data.total,
      ...(showGrid ? data.grid : [0]),
      ...(showGen ? data.generator : [0]),
    );
  }

  const top = niceMax(max);

  const y = (value) =>
    CHART_BOTTOM - (value / top) * (CHART_BOTTOM - CHART_TOP);

  const xs = data.labels.map((label, i) =>
    count === 1
      ? (CHART_LEFT + CHART_RIGHT) / 2
      : CHART_LEFT + (i * (CHART_RIGHT - CHART_LEFT)) / (count - 1),
  );

  // ----- grid lines -----
  let gridPath = "";

  for (let i = 0; i <= 4; i++) {
    const gy = CHART_TOP + i * 44;
    gridPath += `M${CHART_LEFT} ${gy}H${CHART_RIGHT} `;
  }

  xs.forEach((x) => {
    gridPath += `M${x} ${CHART_TOP}V${CHART_BOTTOM} `;
  });

  chart.querySelector(".gridlines").innerHTML = `<path d="${gridPath}"/>`;

  // ----- axis labels -----
  let labelsHtml = "";

  for (let i = 0; i <= 4; i++) {
    const gy = CHART_TOP + i * 44;
    const value = (top * (4 - i)) / 4;

    labelsHtml += `<text x="50" y="${gy + 4}" text-anchor="end">${moneyShort(value)}</text>`;
  }

  // show at most ~8 date labels so they never overlap
  const step = Math.ceil(count / 8) || 1;

  data.labels.forEach((label, i) => {
    if (i % step === 0 || i === count - 1) {
      labelsHtml += `<text class="xlabel" x="${xs[i]}" y="222">${escapeHtml(label)}</text>`;
    }
  });

  chart.querySelector(".chart-labels").innerHTML = labelsHtml;

  // ----- lines & dots -----
  const totalY = data.total.map(y);
  const gridY = data.grid.map(y);
  const genY = data.generator.map(y);

  chart
    .querySelector(".area")
    .setAttribute(
      "d",
      hasData
        ? pathFrom(xs, totalY) +
            ` L${xs[count - 1]} ${CHART_BOTTOM} L${xs[0]} ${CHART_BOTTOM} Z`
        : "",
    );

  chart
    .querySelector(".total-line")
    .setAttribute("d", hasData ? pathFrom(xs, totalY) : "");

  chart
    .querySelector(".grid-line")
    .setAttribute("d", hasData && showGrid ? pathFrom(xs, gridY) : "");

  chart
    .querySelector(".gen-line")
    .setAttribute("d", hasData && showGen ? pathFrom(xs, genY) : "");

  chart.querySelector(".total-dots").innerHTML = hasData
    ? dotsFrom(xs, totalY)
    : "";

  chart.querySelector(".grid-dots").innerHTML =
    hasData && showGrid ? dotsFrom(xs, gridY) : "";

  chart.querySelector(".gen-dots").innerHTML =
    hasData && showGen ? dotsFrom(xs, genY) : "";

  // ----- empty message -----
  document.getElementById("chartEmpty").hidden = hasData;
}

const chart = document.getElementById("chart");

document.querySelectorAll(".tabs button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector(".tabs .selected")?.classList.remove("selected");

    button.classList.add("selected");

    chartPeriod = button.dataset.period;

    renderChart();
  });
});

// ==========================================
// 8. POWER SOURCE BREAKDOWN (DONUT)
// ==========================================

function renderBreakdown() {
  const sources = getSources();
  const b = dashboard.breakdown || {};

  const grid = sources.includes("grid") ? b.grid || 0 : 0;
  const generator = sources.includes("generator") ? b.generator || 0 : 0;
  const total = grid + generator;

  const gridPct = total ? Math.round((grid / total) * 100) : 0;
  const genPct = total ? 100 - gridPct : 0;

  const donut = document.getElementById("donut");

  if (total === 0) {
    donut.style.background = "#e3ede6"; // empty ring
  } else if (generator === 0) {
    donut.style.background = "#075a2b"; // grid only
  } else if (grid === 0) {
    donut.style.background = "#91d96c"; // generator only
  } else {
    donut.style.background = `conic-gradient(#075a2b 0 ${gridPct}%, #91d96c ${gridPct}%)`;
  }

  document.getElementById("donutTotal").textContent = money(total);

  document.getElementById("breakdownGrid").textContent =
    `${money(grid)} (${gridPct}%)`;

  document.getElementById("breakdownGenerator").textContent =
    `${money(generator)} (${genPct}%)`;
}

// ==========================================
// 9. RECENT ACTIVITY
// ==========================================

function renderActivity() {
  const list = document.getElementById("activityList");
  const empty = document.getElementById("activityEmpty");
  const items = (dashboard.activity || []).slice(0, 3);

  list.innerHTML = "";

  items.forEach((item) => {
    const row = document.createElement("div");

    const time = document.createElement("time");
    time.textContent = formatDateTime(item.timestamp);

    const text = document.createElement("p");
    text.textContent = item.message;

    row.appendChild(time);
    row.appendChild(text);
    list.appendChild(row);
  });

  list.hidden = items.length === 0;
  empty.hidden = items.length > 0;
}

// ==========================================
// 10. KEY INSIGHTS
// ==========================================

function setNote(id, text) {
  const element = document.getElementById(id);

  element.textContent = text || "";
  element.hidden = !text;
}

function renderInsights() {
  const i = dashboard.insights || {};

  // Generator
  document.getElementById("insGenCost").textContent = i.generatorCostPerHour
    ? money(i.generatorCostPerHour)
    : "—";

  setNote(
    "insGenNote",
    i.generatorCostPerHour ? "Based on latest session" : "",
  );

  // Battery
  document.getElementById("insBattery").textContent = i.batteryRuntimeHours
    ? i.batteryRuntimeHours + " hours"
    : "—";

  setNote(
    "insBatteryNote",
    i.batteryRuntimeHours && i.batteryLoadWatts
      ? `For ${i.batteryLoadWatts}W load`
      : "",
  );

  // Best option
  document.getElementById("insBest").textContent = i.bestOption
    ? i.bestOption.name
    : "—";

  setNote("insBestTag", i.bestOption ? i.bestOption.label : "");
}

// ==========================================
// 11. RENDER EVERYTHING
// ==========================================

function renderAll() {
  renderProfile(dashboard);
  applyPowerSources();
  renderMetrics();
  renderChart();
  renderBreakdown();
  renderActivity();
  renderInsights();

  document.getElementById("demoNote").hidden =
    new URLSearchParams(location.search).get("demo") !== "1";
}

// ==========================================
// 12. DATE FILTER
// ==========================================

dateRange.addEventListener("change", () => {
  loadDashboard(dateRange.value);
});

// ==========================================
// 13. MOBILE SIDEBAR
// ==========================================

menuBtn.addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

document.addEventListener("click", (event) => {
  if (
    window.innerWidth <= 760 &&
    sidebar.classList.contains("open") &&
    !sidebar.contains(event.target) &&
    !menuBtn.contains(event.target)
  ) {
    sidebar.classList.remove("open");
  }
});

// ==========================================
// 14. SAMPLE DATA (preview only: open the page with ?demo=1)
//     Delete this section once the backend is connected.
// ==========================================

function sampleDashboard() {
  const data = emptyDashboard();

  // Use the power sources chosen on the setup page, or all three
  if (data.business.powerSources.length === 0) {
    data.business.powerSources = ["grid", "generator", "battery"];
  }

  const has = (source) => data.business.powerSources.includes(source);

  const make = (labels, gridValues, genValues) => ({
    labels: labels,
    grid: has("grid") ? gridValues : labels.map(() => 0),
    generator: has("generator") ? genValues : labels.map(() => 0),
    total: labels.map(
      (l, i) =>
        (has("grid") ? gridValues[i] : 0) +
        (has("generator") ? genValues[i] : 0),
    ),
  });

  data.trend.weekly = make(
    ["Oct 20", "Oct 21", "Oct 22", "Oct 23", "Oct 24", "Oct 26"],
    [14000, 20000, 15000, 22000, 17000, 25000],
    [27000, 33000, 28000, 36000, 31000, 42000],
  );

  data.trend.monthly = make(
    ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"],
    [12000, 18000, 16000, 24000, 21000, 27000],
    [22000, 26000, 30000, 34000, 33000, 40000],
  );

  data.trend.yearly = make(
    ["May", "Jun", "Jul", "Aug", "Sep", "Oct"],
    [30000, 36000, 42000, 39000, 46000, 50000],
    [18000, 24000, 27000, 29000, 31000, 35000],
  );

  data.summary = {
    totalExpenses: {
      amount: (has("grid") ? 50000 : 0) + (has("generator") ? 35000 : 0),
      changePercent: 12,
    },
    generatorFuel: { amount: 35000, changePercent: 8 },
    gridElectricity: { amount: 50000, changePercent: 5 },
    batteryRuntimeHours: 8.6,
  };

  data.breakdown = { grid: 50000, generator: 35000 };

  data.activity = [
    {
      timestamp: "2025-10-26T10:45:00",
      message: "Generator session recorded (4 hrs, 5L)",
    },
    {
      timestamp: "2025-10-25T09:20:00",
      message: "Electricity expense added (₦15,000)",
    },
    {
      timestamp: "2025-10-24T14:15:00",
      message: "Fuel purchase recorded (₦20,000)",
    },
  ];

  data.insights = {
    generatorCostPerHour: 1250,
    batteryRuntimeHours: 8.6,
    batteryLoadWatts: 400,
    bestOption: { name: "Inverter", label: "More Economical" },
  };

  return data;
}

// ==========================================
// 15. START
// ==========================================

currentUser = await requireUser();

console.log("Signed-in user:", currentUser.displayName, currentUser.email);

loadDashboard(dateRange.value);

// ==========================================
// 16. PROFILE AREA -> BUSINESS SETUP
// ==========================================

// "Go to Calculator" opens the comparison page.
const calculatorButton = document.querySelector(".promo-card button");

if (calculatorButton) {
  calculatorButton.addEventListener("click", () => {
    window.location.href = "Compare.html";
  });
}

