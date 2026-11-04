/* =================================
   POWERGUARD COMPARE JAVASCRIPT
=================================

   HOW THIS PAGE WORKS
   1. loadCompare() asks the backend for the numbers it needs to compare this
      user's power options: their generator fuel use and price (from the
      Generator page), their saved battery details (from the Battery page)
      and their electricity price. Nothing is invented by the page.
   2. A new user has none of these yet, so the result cards show "—" and
      tell the user which page to fill in first.
   3. "Run Comparison" works out the costs in the browser (formulas in
      section 6) and saves the outcome so the Overview page can show the
      "Best Option for Next Outage".
   4. The page only appears if the user chose BOTH a generator and an
      inverter / battery at the Business Setup page.
   5. Backend calls live in the `api` object in section 4. That is the ONLY
      place the backend developer edits. Formats are in COMPARE_API.md.

   To preview the design with sample figures, add ?demo=1 to the address.
   Until API_BASE_URL is filled in, the page runs in LOCAL MODE.
*/


// =================================
// 1. SETTINGS & ELEMENTS
// =================================

const API_BASE_URL = "";                 // e.g. "https://api.powerguard.com"
const USE_BACKEND = API_BASE_URL !== "";
const DEMO = new URLSearchParams(location.search).get("demo") === "1";

const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menuBtn");
const toast = document.getElementById("toast");
const periodFilter = document.getElementById("periodFilter");

const form = document.getElementById("compareForm");
const runBtn = document.getElementById("runBtn");
const loadInput = document.getElementById("loadWatts");
const hoursInput = document.getElementById("outageHours");
const optGenerator = document.getElementById("optGenerator");
const optInverter = document.getElementById("optInverter");

const genCard = document.getElementById("genCard");
const invCard = document.getElementById("invCard");
const versus = document.getElementById("versus");

// Page state
let data = {
    user: null,
    business: { powerSources: [] },
    inputs: {
        defaultLoadWatts: null,
        generator: null,
        battery: null,
        electricityPricePerKwh: null
    },
    lastRun: null
};

let saving = false;


// =================================
// 2. HELPERS
// =================================

function money(amount) {
    return "₦" + Math.round(Number(amount) || 0).toLocaleString("en-NG");
}

// 5 -> "5", 1.5 -> "1.5", 2.50 -> "2.5"
function num(value) {
    return String(+Number(value || 0).toFixed(2));
}

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

function hoursText(hours) {
    return num(hours) + (Number(hours) === 1 ? " hr" : " hrs");
}


// =================================
// 3. USER PROFILE (name + initials)
// =================================

// TEMPORARY: the login page saves the signed-up name in the browser.
// The backend can send the user inside the response (data.user) instead;
// that is used first when it exists.

function getSavedUser() {

    try {
        return JSON.parse(localStorage.getItem("powerguardUser") || "null");
    } catch (error) {
        return null;
    }

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

// --- 4a. Local mode (no backend yet) -------------------------------

function localGet() {

    const setup = getSavedSetup();

    const base = {
        user: null,
        business: { powerSources: setup && setup.powerSources ? setup.powerSources : [] },
        inputs: {
            defaultLoadWatts: null,
            generator: null,
            battery: null,
            electricityPricePerKwh: null
        },
        lastRun: null
    };

    // ?demo=1 -> sample figures (these give the numbers in the design)
    if (DEMO) {

        base.inputs = {
            defaultLoadWatts: 600,
            generator: { litresPerHour: 1.5, fuelPricePerLitre: 1000 },
            battery: {
                voltage: 24, capacityAh: 200, batteryCount: 1,
                dodPercent: 80, healthPercent: 100, efficiencyPercent: 90
            },
            electricityPricePerKwh: 450
        };

        base.lastRun = { loadWatts: 600, outageHours: 4 };

    }

    return base;

}

// --- 4b. Real backend calls ----------------------------------------

// TODO (backend): decide how the login token is stored and sent.
function authHeaders() {

    const token = localStorage.getItem("powerguardToken");

    return token ? { Authorization: "Bearer " + token } : {};

}

async function request(path, options = {}) {

    const response = await fetch(API_BASE_URL + path, {
        ...options,
        headers: { ...authHeaders(), ...(options.headers || {}) }
    });

    if (!response.ok) {

        let message = "Request failed (" + response.status + ")";

        try {
            const body = await response.json();
            if (body.message) message = body.message;
        } catch (error) { /* no JSON body */ }

        throw new Error(message);

    }

    return response.status === 204 ? null : response.json();

}

// --- 4c. The api object the page uses -------------------------------

const api = {

    // range = "7d" | "30d" | "90d" | "all"
    // (used by the backend to average the generator's fuel use over that period)
    async get(range) {

        if (!USE_BACKEND) return localGet();

        return request(`/api/compare?range=${range}`);

    },

    // run = { loadWatts, outageHours, options, results, bestOption, estimatedSaving }
    async saveRun(run) {

        if (!USE_BACKEND) return;

        return request("/api/compare/runs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(run)
        });

    }

};


// =================================
// 5. LOAD DATA
// =================================

async function loadCompare() {

    try {
        data = await api.get(periodFilter.value);
    } catch (error) {
        console.error(error);
        showToast("Could not load your details. Please try again.");
    }

    renderAll();

}


// =================================
// 6. THE COMPARISON FORMULAS
// =================================
//
//   GENERATOR
//     fuel needed (L)  = litres per hour x outage hours
//     fuel cost        = fuel needed x fuel price per litre
//
//   INVERTER
//     energy from battery (Wh) = load x hours / inverter efficiency
//     usable battery (Wh)      = voltage x Ah x batteries x DoD x health
//     battery usage            = energy from battery / usable battery
//     recharge cost            = energy from battery (kWh) x electricity price
//
//   Example (600 W for 4 hours):
//     Generator: 1.5 L/hr x 4 = 6 L  x ₦1,000 = ₦6,000
//     Inverter : 600 x 4 / 0.9 = 2,667 Wh = 2.667 kWh x ₦450 = ₦1,200
//     Saving   : ₦6,000 - ₦1,200 = ₦4,800

function compareGenerator(load, hours) {

    const g = data.inputs.generator;

    if (!g || !(g.litresPerHour > 0) || !(g.fuelPricePerLitre > 0)) {
        return { ready: false };
    }

    const fuel = g.litresPerHour * hours;

    return {
        ready: true,
        fuelLitres: fuel,
        cost: fuel * g.fuelPricePerLitre,
        runtimeHours: hours,
        litresPerHour: g.litresPerHour,
        price: g.fuelPricePerLitre
    };

}

function compareInverter(load, hours) {

    const b = data.inputs.battery;
    const tariff = data.inputs.electricityPricePerKwh;

    if (!b || !(b.voltage > 0) || !(b.capacityAh > 0)) {
        return { ready: false };
    }

    const efficiency = (b.efficiencyPercent || 90) / 100;
    const count = b.batteryCount || 1;

    const neededWh = (load * hours) / efficiency;

    const usableWh = b.voltage * b.capacityAh * count *
        ((b.dodPercent || 100) / 100) * ((b.healthPercent || 100) / 100);

    const batteryHours = (usableWh * efficiency) / load;

    return {
        ready: true,
        costKnown: tariff > 0,
        cost: tariff > 0 ? (neededWh / 1000) * tariff : null,
        usagePercent: (neededWh / usableWh) * 100,
        batteryHours: batteryHours,
        runtimeHours: Math.min(hours, batteryHours),
        coversOutage: batteryHours >= hours,
        efficiencyPercent: b.efficiencyPercent || 90,
        capacityAh: b.capacityAh
    };

}


// =================================
// 7. WHICH OPTIONS DOES THIS USER HAVE?
// =================================

function hasSource(source) {

    const sources = (data.business && data.business.powerSources) || [];

    // If setup was never completed we cannot know, so keep the page usable.
    return sources.length === 0 || sources.includes(source);

}

function applyAccess() {

    // Comparison needs a generator AND an inverter / battery
    const enabled = hasSource("generator") && hasSource("battery");

    document.getElementById("compareContent").hidden = !enabled;
    document.getElementById("notEnabled").hidden = enabled;

}


// =================================
// 8. SHOW THE RESULT
// =================================

function resetCards() {

    ["genCost", "genRuntime", "genFuel", "invCost", "invRuntime", "invUsage"]
        .forEach((id) => { document.getElementById(id).textContent = "—"; });

    document.getElementById("genCostLabel").textContent = "Estimated Fuel Cost";
    document.getElementById("invCostLabel").textContent = "Estimated Recharge Cost";

    document.getElementById("invWarning").hidden = true;

}

function renderGenerator(result, hours) {

    const assumptions = document.getElementById("genAssumptions");

    document.getElementById("genCostLabel").textContent =
        `Estimated Fuel Cost (${num(hours)} hour${Number(hours) === 1 ? "" : "s"})`;

    if (!result.ready) {
        assumptions.innerHTML =
            'We need your generator details. <a href="generator.html">Record a generator session</a> first.';
        return;
    }

    document.getElementById("genCost").textContent = money(result.cost);
    document.getElementById("genRuntime").textContent = hoursText(result.runtimeHours);
    document.getElementById("genFuel").textContent = num(result.fuelLitres) + " Litres";

    assumptions.textContent =
        `Fuel consumption: ${num(result.litresPerHour)} L/hr  |  Fuel price: ${money(result.price)}/L`;

}

function renderInverter(result, hours) {

    const assumptions = document.getElementById("invAssumptions");
    const warning = document.getElementById("invWarning");

    document.getElementById("invCostLabel").textContent =
        `Estimated Recharge Cost (${num(hours)} hour${Number(hours) === 1 ? "" : "s"})`;

    if (!result.ready) {
        assumptions.innerHTML =
            'We need your battery details. <a href="battery.html">Save them on the Battery page</a> first.';
        return;
    }

    document.getElementById("invCost").textContent =
        result.costKnown ? money(result.cost) : "—";

    document.getElementById("invRuntime").textContent = hoursText(result.runtimeHours);

    document.getElementById("invUsage").textContent =
        result.usagePercent > 100 ? ">100%" : "~" + Math.round(result.usagePercent) + "%";

    assumptions.textContent =
        `Inverter efficiency: ${result.efficiencyPercent}%  |  Battery capacity: ${num(result.capacityAh)}Ah`;

    // Honest warnings
    if (!result.coversOutage) {
        warning.textContent =
            `Your battery can only run this load for about ${num(result.batteryHours)} hrs of the ${num(hours)}-hour outage.`;
        warning.hidden = false;
    } else if (!result.costKnown) {
        warning.textContent =
            "Your electricity price isn't set, so the recharge cost can't be shown yet.";
        warning.hidden = false;
    }

}

function renderInsight(gen, inv) {

    const text = document.getElementById("insightText");

    if (!gen || !inv || !gen.ready || !inv.ready || !inv.costKnown) {
        text.textContent =
            "Add the missing details above to see which option is more economical.";
        return null;
    }

    const saving = Math.abs(gen.cost - inv.cost);

    if (saving < 1) {
        text.textContent = "Both options cost about the same for this outage.";
        return { best: null, saving: 0 };
    }

    const best = inv.cost < gen.cost ? "Inverter" : "Generator";

    text.innerHTML =
        `The ${best} is more economical for this outage,<br>` +
        `saving an estimated <b>${money(saving)}</b>.`;

    return { best: best, saving: saving };

}

function runComparison(load, hours) {

    resetCards();

    const useGen = optGenerator.checked && hasSource("generator");
    const useInv = optInverter.checked && hasSource("battery");

    genCard.hidden = !useGen;
    invCard.hidden = !useInv;
    versus.classList.toggle("single", !(useGen && useInv));

    const gen = useGen ? compareGenerator(load, hours) : null;
    const inv = useInv ? compareInverter(load, hours) : null;

    if (gen) renderGenerator(gen, hours);
    if (inv) renderInverter(inv, hours);

    let outcome = null;

    if (useGen && useInv) {
        outcome = renderInsight(gen, inv);
    } else {
        document.getElementById("insightText").textContent =
            "Select both options to see which is more economical.";
    }

    refreshIcons();

    return { gen, inv, outcome, useGen, useInv };

}


// =================================
// 9. RENDER EVERYTHING (after loading from the backend)
// =================================

function renderAll() {

    renderProfile();
    applyAccess();

    // Remembered load / duration -> fill the form and show the result
    if (data.lastRun) {

        loadInput.value = data.lastRun.loadWatts;
        hoursInput.value = data.lastRun.outageHours;

        runComparison(Number(data.lastRun.loadWatts), Number(data.lastRun.outageHours));

    } else {

        if (data.inputs && data.inputs.defaultLoadWatts && !loadInput.value) {
            loadInput.value = data.inputs.defaultLoadWatts;
        }

        resetCards();

    }

    refreshIcons();

}


// =================================
// 10. RUN COMPARISON BUTTON
// =================================

form.addEventListener("submit", async (event) => {

    event.preventDefault();

    if (saving) return;

    const load = Number(loadInput.value);
    const hours = Number(hoursInput.value);

    if (!(load > 0) || !(hours > 0)) {
        showToast("Please enter the connected load and the outage duration.");
        return;
    }

    if (!optGenerator.checked && !optInverter.checked) {
        showToast("Select at least one option to compare.");
        return;
    }

    const { gen, inv, outcome, useGen, useInv } = runComparison(load, hours);

    // Save the run so the Overview can show the best option
    saving = true;
    runBtn.disabled = true;

    try {

        await api.saveRun({
            loadWatts: load,
            outageHours: hours,
            options: [useGen ? "generator" : null, useInv ? "inverter" : null].filter(Boolean),
            results: {
                generator: gen && gen.ready
                    ? { cost: Math.round(gen.cost), fuelLitres: Number(num(gen.fuelLitres)) }
                    : null,
                inverter: inv && inv.ready && inv.costKnown
                    ? { cost: Math.round(inv.cost), batteryUsagePercent: Math.round(inv.usagePercent) }
                    : null
            },
            bestOption: outcome ? outcome.best : null,
            estimatedSaving: outcome ? Math.round(outcome.saving) : 0
        });

    } catch (error) {

        console.error(error);
        showToast("Compared, but we could not save it. " + (error.message || ""));

    } finally {

        saving = false;
        runBtn.disabled = false;

    }

});


// =================================
// 11. DATE FILTER
// =================================

periodFilter.addEventListener("change", () => {

    loadCompare();

});


// =================================
// 12. MOBILE SIDEBAR
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
// 13. START
// =================================

refreshIcons();

loadCompare();