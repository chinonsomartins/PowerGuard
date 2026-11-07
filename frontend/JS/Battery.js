import { requireUser } from "./session.js";
import { apiGet, apiPut } from "./api.js";

/* =================================
   POWERGUARD BATTERY JAVASCRIPT
=================================

   HOW THIS PAGE WORKS
   1. loadBattery() asks the backend for this user's SAVED battery settings
      and their latest estimate.
   2. A new user has nothing saved, so the form starts empty (with sensible
      defaults for the dropdowns) and the result shows "—".
   3. When the user presses "Calculate Runtime" the runtime is worked out in
      the browser (formula in section 6) and the details + result are sent to
      the backend to be saved. The Overview page can then show the latest
      battery runtime.
   4. The page is only active if the user chose an inverter / battery at the
      Business Setup page. Otherwise a message explains how to switch it on.
   5. Backend calls live in the `api` object in section 4. That is the ONLY
      place the backend developer edits. Formats are in BATTERY_API.md.

   Until API_BASE_URL is filled in, the page runs in LOCAL MODE: calculations
   work, but nothing is saved after the page is refreshed.
*/


// =================================
// 1. SETTINGS & ELEMENTS
// =================================

let currentUser = null;
const USE_BACKEND = true;

const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menuBtn");
const toast = document.getElementById("toast");
const periodFilter = document.getElementById("periodFilter");

const form = document.getElementById("batteryForm");
const calcBtn = document.getElementById("calcBtn");

const fields = {
    voltage: document.getElementById("voltage"),
    capacityAh: document.getElementById("capacity"),
    chemistry: document.getElementById("chemistry"),
    batteryCount: document.getElementById("configuration"),
    dodPercent: document.getElementById("dod"),
    healthPercent: document.getElementById("health"),
    efficiencyPercent: document.getElementById("efficiency"),
    loadWatts: document.getElementById("load")
};

const ring = document.getElementById("ring");

// Page state
let data = {
    user: null,
    business: { powerSources: [] },
    settings: null,
    lastEstimate: null
};

let currentResult = null;       // { runtimeHours, usableEnergyWh, usablePercent }
let currentLoad = null;
let saving = false;


// =================================
// 2. HELPERS
// =================================

function showToast(message) {

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => toast.classList.remove("show"), 2800);

}

function refreshIcons() {

    if (window.lucide) {
        lucide.createIcons();
    }

}

// 8.64 -> "8.64", 17.28 -> "17.28"
function fixed(value, digits) {
    return Number(value).toFixed(digits);
}

// 8.64 hours -> "≈ 8 hrs 38 mins"
function hoursToText(hours) {

    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;

    if (h === 0) return `≈ ${m} mins`;
    if (m === 0) return `≈ ${h} hrs`;

    return `≈ ${h} hrs ${m} mins`;

}


// =================================
// 3. USER PROFILE (name + initials)
// =================================

// TEMPORARY: the login page saves the signed-up name in the browser.
// The backend can send the user inside the response (data.user) instead;
// that is used first when it exists.

function getSavedUser() {

    return currentUser
        ? {
            fullName: currentUser.displayName || (currentUser.email || "").split("@")[0],
            email: currentUser.email
        }
        : null;

}

function getSavedSetup() {

    try {
        return JSON.parse(sessionStorage.getItem("powerguardBusinessSetup") || "null");
    } catch (error) {
        return null;
    }

}

// "John Doe" -> "JD"   "Mary Ann Smith" -> "MS"   "Victory" -> "V"
function getInitials(fullName) {

    const parts = fullName.trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) return "U";

    const first = parts[0][0];
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";

    return (first + last).toUpperCase();

}

function renderProfile() {

    const saved = getSavedUser();
    const setup = getSavedSetup();

    const fullName = (data.user && data.user.fullName) || (saved && saved.fullName) || "";
    const business = (data.user && data.user.businessName) ||
        (setup && setup.businessName) || "Set up your business";

    document.getElementById("profileName").textContent = fullName || "Your Name";
    document.getElementById("profileAvatar").textContent = fullName ? getInitials(fullName) : "U";
    document.getElementById("profileBusiness").textContent = business;

}


// =================================
// 4. DATA LAYER  (backend developer: edit this section only)
// =================================


// --- 4c. The api object the page uses -------------------------------

function fromApiBattery(b) {

    return {
        voltage: b.unit_voltage_v,
        capacityAh: b.unit_capacity_ah,
        chemistry: b.chemistry || undefined,
        batteryCount: b.n_parallel,
        dodPercent: b.usable_dod_percent ?? undefined,
        healthPercent: b.capacity_health_percent ?? undefined,
        efficiencyPercent: b.inverter_efficiency_percent ?? undefined,
        loadWatts: b.load_w
    };

}

const api = {

    async get() {

        const [profile, battery] = await Promise.all([
            apiGet("/api/v1/business"),
            apiGet("/api/v1/battery-profile")
        ]);

        return {
            user: profile ? { fullName: "", businessName: profile.name } : null,
            business: { powerSources: profile ? profile.power_sources : [] },
            settings: battery ? fromApiBattery(battery) : null,
            lastEstimate: null
        };

    },

    // The bank is saved as one string of batteries in parallel (voltage x capacity x count).
    async saveEstimate(payload) {

        const s = payload.settings;

        return apiPut("/api/v1/battery-profile", {
            unit_voltage_v: s.voltage,
            unit_capacity_ah: s.capacityAh,
            n_series: 1,
            n_parallel: s.batteryCount,
            load_w: s.loadWatts,
            standby_w: 0,
            chemistry: s.chemistry,
            usable_dod_percent: s.dodPercent,
            capacity_health_percent: s.healthPercent,
            inverter_efficiency_percent: s.efficiencyPercent
        });

    }

};


// =================================
// 5. LOAD DATA
// =================================

async function loadBattery() {

    try {
        data = await api.get(periodFilter.value);
    } catch (error) {
        console.error(error);
        showToast("Could not load your battery details. Please try again.");
    }

    renderAll();

}


// =================================
// 6. THE RUNTIME FORMULA
// =================================
//
//   total energy   = voltage x capacity (Ah) x number of batteries
//   usable energy  = total energy x DoD x health x inverter efficiency
//   runtime (hrs)  = usable energy / load (watts)
//
//   Example: 24 V x 200 Ah x 1 = 4,800 Wh
//            x 80% x 100% x 90% = 3,456 Wh
//            3,456 / 400 W      = 8.64 hours (about 8 hrs 38 mins)

function readSettings() {

    return {
        voltage: Number(fields.voltage.value),
        capacityAh: Number(fields.capacityAh.value),
        chemistry: fields.chemistry.value,
        batteryCount: Number(fields.batteryCount.value),
        dodPercent: Number(fields.dodPercent.value),
        healthPercent: Number(fields.healthPercent.value),
        efficiencyPercent: Number(fields.efficiencyPercent.value),
        loadWatts: Number(fields.loadWatts.value)
    };

}

function usableEnergyWh(s) {

    return s.voltage * s.capacityAh * s.batteryCount *
        (s.dodPercent / 100) * (s.healthPercent / 100) * (s.efficiencyPercent / 100);

}

function calculate(s) {

    const usable = usableEnergyWh(s);

    return {
        runtimeHours: usable / s.loadWatts,
        usableEnergyWh: usable,
        usablePercent: (s.dodPercent * s.healthPercent * s.efficiencyPercent) / 10000
    };

}


// =================================
// 7. IS THE BATTERY SWITCHED ON FOR THIS USER?
// =================================

function batteryEnabled() {

    const sources = (data.business && data.business.powerSources) || [];

    // If setup was never completed we cannot know, so keep the page usable.
    return sources.length === 0 || sources.includes("battery");

}

function applyAccess() {

    const enabled = batteryEnabled();

    document.getElementById("batteryContent").hidden = !enabled;
    document.getElementById("notEnabled").hidden = enabled;

}


// =================================
// 8. FILL THE FORM FROM SAVED SETTINGS
// =================================

function setSelect(select, value) {

    if (value === undefined || value === null) return;

    if ([...select.options].some((o) => o.value === String(value))) {
        select.value = String(value);
    }

}

function fillForm(settings) {

    if (!settings) return;

    fields.voltage.value = settings.voltage ?? "";
    fields.capacityAh.value = settings.capacityAh ?? "";
    fields.loadWatts.value = settings.loadWatts ?? "";

    setSelect(fields.chemistry, settings.chemistry);
    setSelect(fields.batteryCount, settings.batteryCount);
    setSelect(fields.dodPercent, settings.dodPercent);
    setSelect(fields.healthPercent, settings.healthPercent);
    setSelect(fields.efficiencyPercent, settings.efficiencyPercent);

}


// =================================
// 9. SHOW THE RESULT
// =================================

function renderResult() {

    const hours = document.getElementById("runtimeHours");
    const mins = document.getElementById("runtimeMins");
    const load = document.getElementById("statLoad");
    const energy = document.getElementById("statEnergy");
    const status = document.getElementById("statStatus");

    if (!currentResult) {

        hours.textContent = "— hrs";
        mins.textContent = "Enter your details to calculate";
        load.textContent = "—";
        energy.textContent = "—";
        status.textContent = "Not calculated";
        status.classList.add("pending");

        ring.classList.add("empty");

    } else {

        hours.textContent = fixed(currentResult.runtimeHours, 2) + " hrs";
        mins.textContent = hoursToText(currentResult.runtimeHours);
        load.textContent = Number(currentLoad).toLocaleString("en-NG") + " W";
        energy.textContent = Math.round(currentResult.usableEnergyWh).toLocaleString("en-NG") + " Wh";
        status.textContent = "Estimated";
        status.classList.remove("pending");

        ring.classList.remove("empty");
        ring.style.setProperty("--usable", Math.round(currentResult.usablePercent * 100) + "%");

    }

    renderQuickReference();

}

// Quick reference: same battery, different loads
function renderQuickReference() {

    document.querySelectorAll("#refBody tr").forEach((row) => {

        const load = Number(row.dataset.load);
        const cell = row.children[1];

        row.classList.remove("current");

        if (!currentResult) {
            cell.textContent = "—";
            return;
        }

        const hours = currentResult.usableEnergyWh / load;
        const isCurrent = load === Number(currentLoad);

        cell.textContent = "~ " + fixed(hours, isCurrent ? 2 : 1) + " hrs";

        if (isCurrent) row.classList.add("current");

    });

}


// =================================
// 10. RENDER EVERYTHING (after loading from the backend)
// =================================

function renderAll() {

    renderProfile();
    applyAccess();

    // Saved settings -> fill the form and show the saved result
    if (data.settings) {

        fillForm(data.settings);

        const s = readSettings();

        if (s.voltage > 0 && s.capacityAh > 0 && s.loadWatts > 0) {
            currentResult = calculate(s);
            currentLoad = s.loadWatts;
        }

    } else {

        currentResult = null;
        currentLoad = null;

    }

    renderResult();
    refreshIcons();

}


// =================================
// 11. CALCULATE BUTTON
// =================================

form.addEventListener("submit", async (event) => {

    event.preventDefault();

    if (saving) return;

    const settings = readSettings();

    if (!(settings.voltage > 0) || !(settings.capacityAh > 0) || !(settings.loadWatts > 0)) {
        showToast("Please enter the battery voltage, capacity and total load.");
        return;
    }

    // 1. Calculate and show the answer straight away
    currentResult = calculate(settings);
    currentLoad = settings.loadWatts;

    renderResult();
    refreshIcons();

    // 2. Save the details + result so the user finds them next time
    saving = true;
    calcBtn.disabled = true;

    try {

        await api.saveEstimate({
            settings: settings,
            result: {
                runtimeHours: Number(fixed(currentResult.runtimeHours, 2)),
                usableEnergyWh: Math.round(currentResult.usableEnergyWh)
            }
        });

        showToast(USE_BACKEND
            ? "Runtime calculated and saved."
            : "Runtime calculated.");

    } catch (error) {

        console.error(error);
        showToast("Calculated, but we could not save it. " + (error.message || ""));

    } finally {

        saving = false;
        calcBtn.disabled = false;

    }

});


// =================================
// 12. DATE FILTER
// =================================

periodFilter.addEventListener("change", () => {

    loadBattery();

});


// =================================
// 13. MOBILE SIDEBAR
// =================================

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


// =================================
// 14. START
// =================================

refreshIcons();

currentUser = await requireUser();

loadBattery();