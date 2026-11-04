/* =================================
   POWERGUARD GENERATOR JAVASCRIPT
=================================

   HOW THIS PAGE WORKS
   1. loadGenerator() asks the backend for the user's generator data.
   2. A new user has no sessions, so the page shows empty states
      (0 Litres, ₦0, "No data yet", "No sessions yet").
   3. The page is only active if the user chose "Generator" as a power source
      on the Business Setup page. Otherwise a message explains how to enable it.
   4. Save / edit / delete go through the `api` object in section 4. That is the
      ONLY place the backend developer edits. Formats are in GENERATOR_API.md.
   5. The "Cost Estimator" is a simple calculator that runs in the browser.

   Until API_BASE_URL is filled in, the page runs in LOCAL MODE: you can add,
   edit and delete sessions to test the design, but they live only in memory
   and disappear when the page is refreshed.
*/


// =================================
// 1. SETTINGS & ELEMENTS
// =================================

const API_BASE_URL = "";                 // e.g. "https://api.powerguard.com"
const USE_BACKEND = API_BASE_URL !== "";
const ROWS_BEFORE_VIEW_ALL = 5;

const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menuBtn");
const toast = document.getElementById("toast");

const periodFilter = document.getElementById("periodFilter");
const searchInput = document.getElementById("searchInput");

const sessionForm = document.getElementById("sessionForm");
const saveBtn = document.getElementById("saveBtn");
const sessionDate = document.getElementById("sessionDate");
const fuelType = document.getElementById("fuelType");
const fuelUsed = document.getElementById("fuelUsed");
const runtime = document.getElementById("runtime");
const fuelPrice = document.getElementById("fuelPrice");

const sessionTable = document.getElementById("sessionTable");
const emptyState = document.getElementById("emptyState");
const viewAllBtn = document.getElementById("viewAllBtn");

const modalOverlay = document.getElementById("modalOverlay");
const modalContent = document.getElementById("modalContent");

// Page state
let data = {
    user: null,
    business: { powerSources: [] },
    summary: {},
    sessions: []
};

let searchQuery = "";
let showAll = false;
let editingId = null;
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

function formatDate(date) {

    if (!date) return "";

    return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });

}

function escapeHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[c]));

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

function today() {
    return new Date().toISOString().split("T")[0];
}

// Cost per hour of one session = (litres x price) / hours
function sessionCostPerHour(session) {

    if (session.costPerHour) return session.costPerHour;

    if (!session.runtimeHours) return 0;

    return (session.fuelLitres * session.fuelPricePerLitre) / session.runtimeHours;

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

const localStore = { sessions: [], nextId: 1 };

function buildSummary(sessions) {

    const fuel = sessions.reduce((t, s) => t + s.fuelLitres, 0);
    const hours = sessions.reduce((t, s) => t + s.runtimeHours, 0);
    const spend = sessions.reduce((t, s) => t + s.fuelLitres * s.fuelPricePerLitre, 0);

    return {
        totalFuelLitres: fuel,
        totalRuntimeHours: hours,
        avgCostPerHour: hours ? spend / hours : 0,
        totalSpend: spend,
        changes: { fuel: null, runtime: null, costPerHour: null, spend: null }
    };

}

function localList(range) {

    let list = [...localStore.sessions];

    if (range !== "all") {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - parseInt(range, 10));
        list = list.filter((s) => new Date(s.date + "T00:00:00") >= cutoff);
    }

    list.sort((a, b) => b.date.localeCompare(a.date));

    const setup = getSavedSetup();

    return {
        user: null,
        business: { powerSources: setup && setup.powerSources ? setup.powerSources : [] },
        summary: buildSummary(list),
        sessions: list.map((s) => ({ ...s, costPerHour: sessionCostPerHour(s) }))
    };

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

const jsonHeaders = { "Content-Type": "application/json" };

// --- 4c. The api object the page uses -------------------------------

const api = {

    // range = "7d" | "30d" | "90d" | "all"
    async list(range) {

        if (!USE_BACKEND) return localList(range);

        return request(`/api/generator?range=${range}`);

    },

    // session = { date, fuelType, fuelLitres, runtimeHours, fuelPricePerLitre }
    async create(session) {

        if (!USE_BACKEND) {
            localStore.sessions.push({ id: localStore.nextId++, ...session });
            return;
        }

        return request("/api/generator/sessions", {
            method: "POST",
            headers: jsonHeaders,
            body: JSON.stringify(session)
        });

    },

    async update(id, session) {

        if (!USE_BACKEND) {
            localStore.sessions = localStore.sessions.map((s) =>
                s.id === id ? { ...s, ...session } : s);
            return;
        }

        return request(`/api/generator/sessions/${id}`, {
            method: "PUT",
            headers: jsonHeaders,
            body: JSON.stringify(session)
        });

    },

    async remove(id) {

        if (!USE_BACKEND) {
            localStore.sessions = localStore.sessions.filter((s) => s.id !== id);
            return;
        }

        return request(`/api/generator/sessions/${id}`, { method: "DELETE" });

    }

};


// =================================
// 5. LOAD DATA
// =================================

async function loadGenerator() {

    try {
        data = await api.list(periodFilter.value);
    } catch (error) {
        console.error(error);
        showToast("Could not load your generator data. Please try again.");
    }

    renderAll();

}


// =================================
// 6. IS THE GENERATOR SWITCHED ON FOR THIS USER?
// =================================

function generatorEnabled() {

    const sources = (data.business && data.business.powerSources) || [];

    // If setup was never completed we cannot know, so keep the page usable.
    return sources.length === 0 || sources.includes("generator");

}

function applyAccess() {

    const enabled = generatorEnabled();

    document.getElementById("generatorContent").hidden = !enabled;
    document.getElementById("notEnabled").hidden = enabled;

}


// =================================
// 7. SUMMARY CARDS
// =================================

function setChange(id, percent) {

    const element = document.getElementById(id);

    if (percent === null || percent === undefined) {
        element.className = "no-data";
        element.textContent = "No data yet";
        return;
    }

    element.className = "";
    element.textContent =
        (percent >= 0 ? "↑ " : "↓ ") + Math.abs(percent) + "% vs previous period";

}

function renderSummary() {

    const s = data.summary || {};
    const changes = s.changes || {};

    const litres = s.totalFuelLitres || 0;
    const hours = s.totalRuntimeHours || 0;

    document.getElementById("fuelTotal").textContent =
        num(litres) + (litres === 1 ? " Litre" : " Litres");

    document.getElementById("runtimeTotal").textContent =
        num(hours) + (hours === 1 ? " Hour" : " Hours");

    document.getElementById("costHourTotal").textContent = money(s.avgCostPerHour);
    document.getElementById("spendTotal").textContent = money(s.totalSpend);

    setChange("fuelChange", changes.fuel);
    setChange("runtimeChange", changes.runtime);
    setChange("costHourChange", changes.costPerHour);
    setChange("spendChange", changes.spend);

}


// =================================
// 8. KEY INSIGHTS
// =================================

function periodText() {

    return {
        "7d": "in the last 7 days",
        "30d": "in the last 30 days",
        "90d": "in the last 90 days",
        "all": "so far"
    }[periodFilter.value];

}

function renderInsights() {

    const s = data.summary || {};
    const litres = s.totalFuelLitres || 0;

    document.getElementById("insCostHour").textContent =
        s.avgCostPerHour ? money(s.avgCostPerHour) + "/hour" : "—";

    document.getElementById("insLitres").textContent =
        num(litres) + (litres === 1 ? " Litre" : " Litres");

    document.getElementById("insPeriod").textContent = periodText();

    document.getElementById("insSpend").textContent = money(s.totalSpend);

}


// =================================
// 9. SESSION HISTORY TABLE
// =================================

function getVisibleSessions() {

    return data.sessions.filter((session) => {

        if (!searchQuery) return true;

        return [
            session.fuelType, session.date,
            String(session.fuelLitres), String(session.runtimeHours)
        ].join(" ").toLowerCase().includes(searchQuery);

    });

}

function renderTable() {

    const matching = getVisibleSessions();

    const rows = showAll ? matching : matching.slice(0, ROWS_BEFORE_VIEW_ALL);

    sessionTable.innerHTML = "";

    rows.forEach((session) => {

        const row = document.createElement("tr");

        row.innerHTML = `

            <td>
                <span class="date-cell">
                    <i data-lucide="calendar-days"></i>
                    ${formatDate(session.date)}
                </span>
            </td>

            <td><span class="fuel-badge">${escapeHTML(session.fuelType)}</span></td>

            <td>${num(session.fuelLitres)} L</td>

            <td>${num(session.runtimeHours)} hrs</td>

            <td class="cost-cell">${money(sessionCostPerHour(session))}</td>

            <td>
                <div class="actions">

                    <button data-action="view" data-id="${escapeHTML(session.id)}" title="View">
                        <i data-lucide="eye"></i>
                    </button>

                    <button data-action="edit" data-id="${escapeHTML(session.id)}" title="Edit">
                        <i data-lucide="pencil"></i>
                    </button>

                    <button data-action="delete" data-id="${escapeHTML(session.id)}" title="Delete">
                        <i data-lucide="trash-2"></i>
                    </button>

                </div>
            </td>

        `;

        sessionTable.appendChild(row);

    });

    // Empty states
    const title = document.getElementById("emptyTitle");
    const text = document.getElementById("emptyText");

    if (data.sessions.length === 0) {
        title.textContent = "No sessions yet";
        text.textContent = "Record your first generator session to see it here.";
    } else {
        title.textContent = "No sessions found";
        text.textContent = "Try a different search.";
    }

    emptyState.hidden = rows.length > 0;

    viewAllBtn.hidden = showAll || matching.length <= ROWS_BEFORE_VIEW_ALL;

    refreshIcons();

}


// =================================
// 10. RENDER EVERYTHING
// =================================

function renderAll() {

    renderProfile();
    applyAccess();
    renderSummary();
    renderInsights();
    renderTable();
    refreshIcons();

}


// =================================
// 11. RECORD / EDIT A SESSION
// =================================

function setSaveButton(label) {

    saveBtn.innerHTML = `<i data-lucide="save"></i> ${label}`;
    refreshIcons();

}

function resetForm() {

    sessionForm.reset();
    sessionDate.value = today();

    editingId = null;

    setSaveButton("Save Session");

}

sessionForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    if (saving) return;

    const litres = Number(fuelUsed.value);
    const hours = Number(runtime.value);
    const price = Number(fuelPrice.value);

    if (![litres, hours, price].every((v) => Number.isFinite(v) && v > 0)) {
        showToast("Please enter valid fuel, runtime and price values.");
        return;
    }

    const session = {
        date: sessionDate.value,
        fuelType: fuelType.value,
        fuelLitres: litres,
        runtimeHours: hours,
        fuelPricePerLitre: price
    };

    saving = true;
    saveBtn.disabled = true;

    try {

        if (editingId !== null) {
            await api.update(editingId, session);
            showToast("Session updated successfully!");
        } else {
            await api.create(session);
            showToast("Session saved successfully!");
        }

        resetForm();

        await loadGenerator();

    } catch (error) {

        console.error(error);
        showToast(error.message || "Could not save the session.");

    } finally {

        saving = false;
        saveBtn.disabled = false;

    }

});


// =================================
// 12. TABLE ACTIONS (view / edit / delete)
// =================================

sessionTable.addEventListener("click", async (event) => {

    const button = event.target.closest("button[data-action]");

    if (!button) return;

    // ids may be numbers (local mode) or strings (database ids)
    const session = data.sessions.find((s) => String(s.id) === button.dataset.id);

    if (!session) return;

    const action = button.dataset.action;

    if (action === "view") viewSession(session);
    if (action === "edit") editSession(session);
    if (action === "delete") await deleteSession(session);

});

function viewSession(session) {

    const cost = sessionCostPerHour(session);
    const total = session.fuelLitres * session.fuelPricePerLitre;

    modalContent.innerHTML = `

        <div class="modal-details">

            <div><small>Date</small><strong>${formatDate(session.date)}</strong></div>

            <div><small>Fuel Type</small><strong>${escapeHTML(session.fuelType)}</strong></div>

            <div><small>Fuel Used</small><strong>${num(session.fuelLitres)} Litres</strong></div>

            <div><small>Runtime</small><strong>${num(session.runtimeHours)} Hours</strong></div>

            <div><small>Fuel Price per Litre</small><strong>${money(session.fuelPricePerLitre)}</strong></div>

            <div><small>Total Fuel Cost</small><strong>${money(total)}</strong></div>

            <div><small>Cost per Hour</small><strong>${money(cost)}</strong></div>

        </div>

    `;

    modalOverlay.classList.add("show");

}

function editSession(session) {

    editingId = session.id;

    sessionDate.value = session.date;
    fuelType.value = session.fuelType;
    fuelUsed.value = session.fuelLitres;
    runtime.value = session.runtimeHours;
    fuelPrice.value = session.fuelPricePerLitre;

    setSaveButton("Update Session");

    document.querySelector(".record-panel").scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

    showToast("Edit the details and save your changes.");

}

async function deleteSession(session) {

    if (!window.confirm("Are you sure you want to delete this session?")) return;

    try {

        await api.remove(session.id);

        showToast("Session deleted successfully.");

        await loadGenerator();

    } catch (error) {

        console.error(error);
        showToast(error.message || "Could not delete the session.");

    }

}


// =================================
// 13. COST ESTIMATOR (calculated in the browser, no backend needed)
// =================================

document.getElementById("estimatorForm").addEventListener("submit", (event) => {

    event.preventDefault();

    const litresPerHour = Number(document.getElementById("estLitres").value);
    const price = Number(document.getElementById("estPrice").value);

    if (!(litresPerHour > 0) || !(price > 0)) {
        showToast("Please enter valid fuel consumption and price.");
        return;
    }

    document.getElementById("estResult").textContent = money(litresPerHour * price);

    document.getElementById("estNote").innerHTML =
        `<i data-lucide="droplet"></i> Based on ${num(litresPerHour)} L/hr at ${money(price)} per litre`;

    refreshIcons();

});


// =================================
// 14. SEARCH, FILTER, VIEW ALL, MODAL
// =================================

searchInput.addEventListener("input", () => {

    searchQuery = searchInput.value.toLowerCase().trim();

    renderTable();

});

periodFilter.addEventListener("change", () => {

    showAll = false;

    loadGenerator();

});

viewAllBtn.addEventListener("click", (event) => {

    event.preventDefault();

    showAll = true;

    renderTable();

});

function closeModal() {
    modalOverlay.classList.remove("show");
}

document.getElementById("modalClose").addEventListener("click", closeModal);
document.getElementById("modalDone").addEventListener("click", closeModal);

modalOverlay.addEventListener("click", (event) => {
    if (event.target === modalOverlay) closeModal();
});


// =================================
// 15. MOBILE SIDEBAR
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
// 16. START
// =================================

sessionDate.value = today();

refreshIcons();

loadGenerator();