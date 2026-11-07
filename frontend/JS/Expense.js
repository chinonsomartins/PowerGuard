import { requireUser } from "./session.js";

/* =================================
   POWERGUARD EXPENSES JAVASCRIPT
=================================

   HOW THIS PAGE WORKS
   1. loadExpenses() asks the backend for the user's expenses.
   2. A new user has none, so the page shows empty states (₦0, "No data yet").
   3. Categories, summary cards and filter tabs only appear for the power
      sources the user chose on the Business Setup page.
   4. Add / edit / delete / receipt-extract all go through the `api` object
      in section 4. That is the ONLY place the backend developer edits.
      The request and response formats are in EXPENSES_API.md.

   Until API_BASE_URL is filled in, the page runs in LOCAL MODE: you can
   add, edit and delete expenses to test the design, but they live only in
   memory and disappear when the page is refreshed.
*/


// =================================
// 1. SETTINGS & ELEMENTS
// =================================

const API_BASE_URL = "http://127.0.0.1:8000";
let currentUser = null; 

const USE_BACKEND = API_BASE_URL !== "";
const ROWS_BEFORE_FULL_HISTORY = 10;

const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menuBtn");

const expenseForm = document.getElementById("expenseForm");
const expenseTable = document.getElementById("expenseTable");
const saveBtn = document.getElementById("saveBtn");

const amountInput = document.getElementById("amount");
const categoryInput = document.getElementById("category");
const dateInput = document.getElementById("expenseDate");
const descriptionInput = document.getElementById("description");

const receiptInput = document.getElementById("receiptInput");
const uploadBox = document.getElementById("uploadBox");
const uploadTitle = document.getElementById("uploadTitle");
const fileName = document.getElementById("fileName");
const extractBtn = document.getElementById("extractBtn");

const toast = document.getElementById("toast");

const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const modalContent = document.getElementById("modalContent");
const modalClose = document.getElementById("modalClose");
const modalDone = document.getElementById("modalDone");

const emptyState = document.getElementById("emptyState");
const periodFilter = document.getElementById("periodFilter");
const searchInput = document.getElementById("searchInput");

// Page state
let data = {
    user: null,
    business: { powerSources: [] },
    summary: { totalAmount: 0, changePercent: null, gridAmount: 0, generatorAmount: 0, otherAmount: 0 },
    expenses: []
};

let activeFilter = "All";
let searchQuery = "";
let showFullHistory = false;
let editingId = null;
let selectedReceipt = null;
let receiptId = null;                    // set after a receipt is extracted
let saving = false;


// =================================
// 2. HELPERS
// =================================

function formatCurrency(amount) {
    return "₦" + Number(amount || 0).toLocaleString("en-NG");
}

function formatDate(date) {

    if (!date) return "";

    return new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
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

// --- 4a. Local mode (no backend yet) -------------------------------

const localStore = { expenses: [], nextId: 1 };

function buildSummary(expenses) {

    const sum = (category) => expenses
        .filter((e) => e.category === category)
        .reduce((total, e) => total + e.amount, 0);

    return {
        totalAmount: expenses.reduce((total, e) => total + e.amount, 0),
        changePercent: null,
        gridAmount: sum("Grid Electricity"),
        generatorAmount: sum("Generator"),
        otherAmount: sum("Other")
    };

}

function localList(range) {

    let list = [...localStore.expenses];

    if (range !== "all") {
        const days = parseInt(range, 10);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        list = list.filter((e) => new Date(e.date + "T00:00:00") >= cutoff);
    }

    list.sort((a, b) => b.date.localeCompare(a.date));

    const setup = getSavedSetup();

    return {
        user: null,
        business: { powerSources: setup && setup.powerSources ? setup.powerSources : [] },
        summary: buildSummary(list),
        expenses: list
    };

}

// --- 4b. Real backend calls ----------------------------------------

// TODO (backend): decide how the login token is stored and sent.
async function authHeaders() {

    const token = await currentUser.getIdToken();

    return { Authorization: "Bearer " + token };

}

async function request(path, options = {}) {

    const response = await fetch(API_BASE_URL + path, {
        ...options,
        headers: { ...(await authHeaders()), ...(options.headers || {}) }
    });

    if (!response.ok) {

        let message = "Request failed (" + response.status + ")";

        try {
            const body = await response.json();

            if (typeof body.detail === "string") {
                message = body.detail;
            } else if (Array.isArray(body.detail)) {
                message = body.detail
                    .map((d) => d.loc.slice(1).join(".") + ": " + d.msg)
                    .join("; ");
            }
        } catch (error) { /* no JSON body */ }

        throw new Error(message);

    }

    return response.status === 204 ? null : response.json();

}

const jsonHeaders = { "Content-Type": "application/json" };

// --- 4c. The api object the page uses -------------------------------

const SOURCE_TO_CATEGORY = {
    grid: "Grid Electricity",
    generator_fuel: "Generator",
    inverter_battery: "Other",
    other: "Other"
};

const CATEGORY_TO_SOURCE = {
    "Grid Electricity": "grid",
    "Generator": "generator_fuel",
    "Other": "other"
};

const PROVENANCE_LABELS = {
    manual: "Manual entry",
    ai_extracted_confirmed: "AI extracted",
    sample_demo: "Sample data",
    simulated: "Simulated"
};

function fromApi(e) {

    return {
        id: e.id,
        date: e.date,
        amount: e.amount_ngn,
        category: SOURCE_TO_CATEGORY[e.source] || "Other",
        description: e.note,
        source: PROVENANCE_LABELS[e.provenance] || "Manual entry"
    };

}

async function loadProfile() {

    try {
        return await request("/api/v1/business");
    } catch (error) {
        return null;
    }

}

const api = {

    // range = "7d" | "30d" | "90d" | "all"
    async list(range) {

        const items = await request("/api/v1/expenses?limit=500");

        let list = items.map(fromApi);

        if (range !== "all") {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - parseInt(range, 10));
            list = list.filter((e) => new Date(e.date + "T00:00:00") >= cutoff);
        }

        const profile = await loadProfile();

        return {
            user: profile ? { fullName: "", businessName: profile.name } : null,
            business: { powerSources: profile ? profile.power_sources : [] },
            summary: buildSummary(list),
            expenses: list
        };

    },

    async create(expense) {

        return request("/api/v1/expenses", {
            method: "POST",
            headers: jsonHeaders,
            body: JSON.stringify({
                date: expense.date,
                amount_ngn: expense.amount,
                source: CATEGORY_TO_SOURCE[expense.category] || "other",
                note: expense.description
            })
        });

    },

    // Not built in the API yet.
    async update() {
        throw new Error("Editing expenses is not available yet.");
    },

    async remove() {
        throw new Error("Deleting expenses is not available yet.");
    },

    async extractReceipt() {
        throw new Error("Receipt extraction is coming soon. Please add the expense manually.");
    }

};


// =================================
// 5. LOAD DATA
// =================================

async function loadExpenses() {

    try {
        data = await api.list(periodFilter.value);
    } catch (error) {
        console.error(error);
        showToast("Could not load your expenses. Please try again.");
    }

    renderAll();

}


// =================================
// 6. POWER SOURCES  (what this user sees)
// =================================

function getSources() {

    const sources = (data.business && data.business.powerSources) || [];

    // If setup was never completed we cannot know, so show everything.
    return sources.length ? sources : ["grid", "generator", "battery"];

}

const CATEGORIES = [
    { value: "Grid Electricity", label: "Grid Electricity", source: "grid" },
    { value: "Generator", label: "Generator Fuel", source: "generator" },
    { value: "Other", label: "Other Expenses", source: null }
];

function applyPowerSources() {

    const sources = getSources();

    document.querySelectorAll("[data-source]").forEach((element) => {
        element.hidden = !sources.includes(element.dataset.source);
    });

    // Let the summary cards fill the row
    const visible = document.querySelectorAll("#summaryCards .summary-card:not([hidden])").length;
    document.getElementById("summaryCards").style.setProperty("--cols", visible);

    // Category dropdown: only the user's sources + Other
    const current = categoryInput.value;

    categoryInput.innerHTML = CATEGORIES
        .filter((c) => c.source === null || sources.includes(c.source))
        .map((c) => `<option value="${c.value}">${c.label}</option>`)
        .join("");

    if ([...categoryInput.options].some((o) => o.value === current)) {
        categoryInput.value = current;
    }

    // A filter tab that is now hidden cannot stay selected
    const activeTab = document.querySelector(`.filter-tab[data-filter="${activeFilter}"]`);

    if (activeTab && activeTab.hidden) {
        activeFilter = "All";
        updateActiveTab();
    }

}


// =================================
// 7. SUMMARY CARDS
// =================================

function setPercentOfTotal(id, amount, total) {

    const element = document.getElementById(id);

    if (!total) {
        element.className = "no-data";
        element.textContent = "No data yet";
        return;
    }

    element.className = "";
    element.textContent = Math.round((amount / total) * 100) + "% of total";

}

function renderSummary() {

    const s = data.summary || {};
    const total = s.totalAmount || 0;

    document.getElementById("totalExpenses").textContent = formatCurrency(total);
    document.getElementById("gridTotal").textContent = formatCurrency(s.gridAmount);
    document.getElementById("generatorTotal").textContent = formatCurrency(s.generatorAmount);
    document.getElementById("otherTotal").textContent = formatCurrency(s.otherAmount);

    const change = document.getElementById("totalChange");

    if (s.changePercent === null || s.changePercent === undefined) {
        change.className = "no-data";
        change.textContent = "No data yet";
    } else {
        change.className = "positive";
        change.textContent =
            (s.changePercent >= 0 ? "↑ " : "↓ ") + Math.abs(s.changePercent) + "% vs previous period";
    }

    setPercentOfTotal("gridPercentage", s.gridAmount, total);
    setPercentOfTotal("generatorPercentage", s.generatorAmount, total);
    setPercentOfTotal("otherPercentage", s.otherAmount, total);

}


// =================================
// 8. EXPENSE TABLE
// =================================

function categoryIcon(category) {

    if (category === "Generator") return "fuel";
    if (category === "Grid Electricity") return "tower-control";

    return "ellipsis";

}

function categoryClass(category) {

    return category === "Grid Electricity" ? "grid-badge" : "generator-badge";

}

function categoryLabel(category) {

    return category === "Generator" ? "Generator" : category;

}

function getVisibleExpenses() {

    return data.expenses.filter((expense) => {

        const matchesFilter = activeFilter === "All" || expense.category === activeFilter;

        const matchesSearch = !searchQuery || [
            expense.description, expense.category, expense.source,
            expense.date, String(expense.amount)
        ].join(" ").toLowerCase().includes(searchQuery);

        return matchesFilter && matchesSearch;

    });

}

function renderTable() {

    const matching = getVisibleExpenses();

    const rows = showFullHistory
        ? matching
        : matching.slice(0, ROWS_BEFORE_FULL_HISTORY);

    expenseTable.innerHTML = "";

    rows.forEach((expense) => {

        const row = document.createElement("tr");

        row.innerHTML = `

            <td>
                <span class="date-cell">
                    <i data-lucide="calendar-days"></i>
                    ${formatDate(expense.date)}
                </span>
            </td>

            <td>${escapeHTML(expense.description || "Energy expense")}</td>

            <td>
                <span class="category-badge ${categoryClass(expense.category)}">
                    <i data-lucide="${categoryIcon(expense.category)}"></i>
                    ${escapeHTML(categoryLabel(expense.category))}
                </span>
            </td>

            <td class="amount-cell">${formatCurrency(expense.amount)}</td>

            <td>
                <span class="source-badge ${expense.source === "Measured" ? "measured" : "confirmed"}">
                    <i data-lucide="circle"></i>
                    ${escapeHTML(expense.source || "Confirmed")}
                </span>
            </td>

            <td>
                <div class="actions">

                    <button class="view-btn" data-action="view" data-id="${escapeHTML(expense.id)}" title="View">
                        <i data-lucide="eye"></i>
                    </button>

                </div>
            </td>

        `;

        expenseTable.appendChild(row);

    });

    // Empty states
    const title = document.getElementById("emptyTitle");
    const text = document.getElementById("emptyText");

    if (data.expenses.length === 0) {
        title.textContent = "No expenses yet";
        text.textContent = "Add your first expense or upload a receipt to get started.";
    } else {
        title.textContent = "No expenses found";
        text.textContent = "Try a different filter or search.";
    }

    emptyState.hidden = rows.length > 0;

    // "View Full History" only matters when there are more rows to show
    document.getElementById("historyBtn").hidden =
        showFullHistory || matching.length <= ROWS_BEFORE_FULL_HISTORY;

    refreshIcons();

}


// =================================
// 9. RENDER EVERYTHING
// =================================

function renderAll() {

    renderProfile();
    applyPowerSources();
    renderSummary();
    renderTable();
    refreshIcons();

}


// =================================
// 10. ADD AND EDIT EXPENSES
// =================================

function setSaveButton(label) {

    saveBtn.innerHTML = `<i data-lucide="save"></i> ${label}`;
    refreshIcons();

}

function resetForm() {

    expenseForm.reset();
    dateInput.value = today();

    editingId = null;
    receiptId = null;

    setSaveButton("Save Expense");

}

expenseForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    if (saving) return;

    const amount = Number(amountInput.value);

    if (!Number.isFinite(amount) || amount <= 0) {
        showToast("Please enter a valid expense amount.");
        return;
    }

    const expenseData = {
        date: dateInput.value,
        description: descriptionInput.value.trim() || "Energy expense",
        category: categoryInput.value,
        amount: amount
    };

    if (receiptId) {
        expenseData.receiptId = receiptId;
    }

    saving = true;
    saveBtn.disabled = true;

    try {

        if (editingId !== null) {
            await api.update(editingId, expenseData);
            showToast("Expense updated successfully!");
        } else {
            await api.create(expenseData);
            showToast("Expense added successfully!");
        }

        resetForm();
        clearReceipt();

        activeFilter = "All";
        updateActiveTab();

        await loadExpenses();

    } catch (error) {

        console.error(error);
        showToast(error.message || "Could not save the expense.");

    } finally {

        saving = false;
        saveBtn.disabled = false;

    }

});


// =================================
// 11. FILTER TABS, SEARCH, HISTORY
// =================================

const filterTabs = document.querySelectorAll(".filter-tab");

function updateActiveTab() {

    filterTabs.forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.filter === activeFilter);
    });

}

filterTabs.forEach((tab) => {

    tab.addEventListener("click", () => {

        activeFilter = tab.dataset.filter;

        updateActiveTab();
        renderTable();

    });

});

searchInput.addEventListener("input", () => {

    searchQuery = searchInput.value.toLowerCase().trim();

    renderTable();

});

document.getElementById("historyBtn").addEventListener("click", () => {

    showFullHistory = true;

    renderTable();

});

periodFilter.addEventListener("change", () => {

    showFullHistory = false;

    loadExpenses();

});


// =================================
// 12. TABLE ACTIONS (view / edit / delete)
// =================================

expenseTable.addEventListener("click", async (event) => {

    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const id = button.dataset.id;

    // ids may be numbers (local mode) or strings (database ids)
    const expense = data.expenses.find((e) => String(e.id) === id);

    if (!expense) return;

    const action = button.dataset.action;

    if (action === "view") viewExpense(expense);
    if (action === "edit") editExpense(expense);
    if (action === "delete") await deleteExpense(expense);

});

function viewExpense(expense) {

    modalTitle.textContent = "Expense Details";

    modalContent.innerHTML = `

        <div class="modal-details">

            <div>
                <small>Description</small>
                <strong>${escapeHTML(expense.description)}</strong>
            </div>

            <div>
                <small>Category</small>
                <strong>${escapeHTML(categoryLabel(expense.category))}</strong>
            </div>

            <div>
                <small>Amount</small>
                <strong>${formatCurrency(expense.amount)}</strong>
            </div>

            <div>
                <small>Date</small>
                <strong>${formatDate(expense.date)}</strong>
            </div>

            <div>
                <small>Source</small>
                <strong>${escapeHTML(expense.source)}</strong>
            </div>

        </div>

    `;

    modalOverlay.classList.add("show");

}

function editExpense(expense) {

    editingId = expense.id;

    amountInput.value = expense.amount;
    dateInput.value = expense.date;
    descriptionInput.value = expense.description;

    // make sure the category exists in the dropdown
    if (![...categoryInput.options].some((o) => o.value === expense.category)) {
        categoryInput.add(new Option(categoryLabel(expense.category), expense.category));
    }

    categoryInput.value = expense.category;

    setSaveButton("Update Expense");

    document.querySelector(".manual-panel").scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

    showToast("Edit the details and save your changes.");

}

async function deleteExpense(expense) {

    if (!window.confirm("Are you sure you want to delete this expense?")) return;

    try {

        await api.remove(expense.id);

        showToast("Expense deleted successfully.");

        await loadExpenses();

    } catch (error) {

        console.error(error);
        showToast(error.message || "Could not delete the expense.");

    }

}


// =================================
// 13. MODAL
// =================================

function closeModal() {
    modalOverlay.classList.remove("show");
}

modalClose.addEventListener("click", closeModal);
modalDone.addEventListener("click", closeModal);

modalOverlay.addEventListener("click", (event) => {
    if (event.target === modalOverlay) closeModal();
});


// =================================
// 14. RECEIPT UPLOAD + GEMINI EXTRACTION
// =================================

receiptInput.addEventListener("change", () => {

    const file = receiptInput.files[0];

    if (file) handleReceipt(file);

});

function handleReceipt(file) {

    if (!["image/jpeg", "image/png"].includes(file.type)) {
        showToast("Please upload a JPG or PNG image.");
        receiptInput.value = "";
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showToast("Receipt image must be smaller than 5MB.");
        receiptInput.value = "";
        return;
    }

    selectedReceipt = file;
    receiptId = null;

    uploadTitle.textContent = "Receipt selected successfully";
    fileName.textContent = file.name;
    extractBtn.hidden = false;

    showToast("Receipt uploaded. Ready for extraction.");

}

function clearReceipt() {

    selectedReceipt = null;
    receiptInput.value = "";

    uploadTitle.textContent = "Drag and drop your receipt here";
    fileName.textContent = "Supported formats: JPG, JPEG, PNG";
    extractBtn.hidden = true;

}

uploadBox.addEventListener("dragover", (event) => {
    event.preventDefault();
    uploadBox.classList.add("dragover");
});

uploadBox.addEventListener("dragleave", () => {
    uploadBox.classList.remove("dragover");
});

uploadBox.addEventListener("drop", (event) => {

    event.preventDefault();
    uploadBox.classList.remove("dragover");

    const file = event.dataTransfer.files[0];

    if (file) {

        const transfer = new DataTransfer();
        transfer.items.add(file);
        receiptInput.files = transfer.files;

        handleReceipt(file);

    }

});

// The backend reads the receipt with Gemini and returns the details.
// We put them in the form so the user can REVIEW and CONFIRM before saving.
extractBtn.addEventListener("click", async () => {

    if (!selectedReceipt) {
        showToast("Please upload a receipt first.");
        return;
    }

    extractBtn.disabled = true;
    extractBtn.textContent = "Reading receipt...";

    try {

        const result = await api.extractReceipt(selectedReceipt);

        receiptId = result.receiptId || null;

        if (result.amount) amountInput.value = result.amount;
        if (result.date) dateInput.value = result.date;
        if (result.description) descriptionInput.value = result.description;

        if (result.category &&
            [...categoryInput.options].some((o) => o.value === result.category)) {
            categoryInput.value = result.category;
        }

        showToast("Details extracted. Please review them, then save.");

        document.querySelector(".manual-panel").scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

    } catch (error) {

        console.error(error);
        showToast(error.message || "Could not read the receipt. Please enter it manually.");

    } finally {

        extractBtn.disabled = false;
        extractBtn.innerHTML = '<i data-lucide="sparkles"></i> Extract Receipt Information';
        refreshIcons();

    }

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

dateInput.value = today();

refreshIcons();

currentUser = await requireUser();

loadExpenses();