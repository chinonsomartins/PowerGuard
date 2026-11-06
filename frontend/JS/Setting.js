/* =========================================
   POWERGUARD SETTINGS JAVASCRIPT
=========================================

   This page works on its own (no API yet). It shows what the user chose in
   Business Setup, the same way the other pages do:

   - name, email           <- "powerguardUser"          (saved by the login page)
   - business name, category, location, power sources
                           <- "powerguardBusinessSetup" (saved by Business Setup)

   When the backend is ready, only the two small functions
   readSavedUser() and readSavedBusiness() need to change.
*/

document.addEventListener("DOMContentLoaded", function () {

    const $ = (id) => document.getElementById(id);

    // Same lists as the Business Setup page, so the two always match.
    const SOURCES = [
        { value: "grid", label: "Grid Electricity", icon: "utility-pole" },
        { value: "generator", label: "Generator", icon: "plug-zap" },
        { value: "battery", label: "Inverter / Battery", icon: "battery-charging" }
    ];

    const CATEGORIES = [
        "Retail / Supermarket",
        "Food / Restaurant",
        "Salon / Barbing",
        "Frozen Foods",
        "Printing / Business Centre",
        "Healthcare / Pharmacy",
        "POS / Financial Services",
        "Other"
    ];

    const toast = $("toast");
    let toastTimer;


    // =====================================
    // 1. SAVED DETAILS
    // =====================================

    function readSavedUser() {

        try {
            return JSON.parse(localStorage.getItem("powerguardUser") || "null") || {};
        } catch (error) {
            return {};
        }

    }

    function readSavedBusiness() {

        try {
            return JSON.parse(sessionStorage.getItem("powerguardBusinessSetup") || "null") || {};
        } catch (error) {
            return {};
        }

    }

    const user = readSavedUser();
    const saved = readSavedBusiness();

    let profile = {
        fullName: user.fullName || "",
        email: user.email || "",
        businessName: saved.businessName || "",
        businessCategory: saved.businessCategory || "",
        location: saved.location || "",
        powerSources: Array.isArray(saved.powerSources) ? saved.powerSources : []
    };

    function saveBusiness() {

        sessionStorage.setItem("powerguardBusinessSetup", JSON.stringify({
            businessName: profile.businessName,
            businessCategory: profile.businessCategory,
            location: profile.location,
            powerSources: profile.powerSources
        }));

    }


    // =====================================
    // 2. HELPERS
    // =====================================

    function showToast(message) {

        toast.textContent = message;
        toast.classList.add("show");

        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);

    }

    function refreshIcons() {

        if (window.lucide) lucide.createIcons();

    }

    function showError(id, text) {

        const box = $(id);

        box.textContent = text || "";
        box.hidden = !text;

    }

    // "John Doe" -> "JD"   "Mary Ann Smith" -> "MS"   "Victory" -> "V"
    function getInitials(fullName) {

        const parts = fullName.trim().split(/\s+/).filter(Boolean);

        if (parts.length === 0) return "U";

        const first = parts[0][0];
        const last = parts.length > 1 ? parts[parts.length - 1][0] : "";

        return (first + last).toUpperCase();

    }


    // =====================================
    // 3. SHOW THE DETAILS
    // =====================================

    // the user area at the top (same as every other page)
    function renderUserArea() {

        $("profileName").textContent = profile.fullName || "Your Name";
        $("profileAvatar").textContent = profile.fullName ? getInitials(profile.fullName) : "U";
        $("profileBusiness").textContent = profile.businessName || "Set up your business";

    }

    // only the power sources the user selected, each with its own icon
    function renderSources() {

        const list = $("sourcesList");
        const chosen = SOURCES.filter((s) => profile.powerSources.includes(s.value));

        list.innerHTML = "";

        chosen.forEach((source, index) => {

            if (index > 0) {
                const plus = document.createElement("i");
                plus.setAttribute("data-lucide", "plus");
                plus.className = "source-arrow";
                list.appendChild(plus);
            }

            const item = document.createElement("div");
            item.className = "source-item";

            const circle = document.createElement("div");
            circle.className = "source-icon";

            const icon = document.createElement("i");
            icon.setAttribute("data-lucide", source.icon);
            circle.appendChild(icon);

            const label = document.createElement("span");
            label.textContent = source.label;

            item.appendChild(circle);
            item.appendChild(label);
            list.appendChild(item);

        });

        list.hidden = chosen.length === 0;
        $("noSources").hidden = chosen.length > 0;

    }

    function renderAll() {

        const hasBusiness = !!profile.businessName;

        $("displayBusinessName").textContent = profile.businessName || "No business added yet";
        $("statusBadge").hidden = !hasBusiness;

        $("displayLocation").textContent = profile.location || "No location added";
        $("displayCategory").textContent = profile.businessCategory || "No category chosen";

        $("displayEmail").textContent = profile.email || "—";

        renderSources();
        renderUserArea();
        refreshIcons();

    }


    // =====================================
    // 4. SIDEBAR (mobile)
    // =====================================

    const sidebar = $("sidebar");
    const menuBtn = $("menuBtn");

    menuBtn.addEventListener("click", () => sidebar.classList.toggle("open"));

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


    // =====================================
    // 5. SETTINGS MENU (jump to a section)
    // =====================================

    const tabs = document.querySelectorAll(".settings-tab");

    tabs.forEach((tab) => {

        tab.addEventListener("click", () => {

            tabs.forEach((item) => item.classList.remove("active"));
            tab.classList.add("active");

            const section = $(tab.dataset.section);

            if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });

        });

    });


    // =====================================
    // 6. EDIT BUSINESS PROFILE
    // =====================================

    $("businessCategory").innerHTML =
        '<option value="">Select category</option>' +
        CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("");

    $("sourceChoices").innerHTML = SOURCES.map((s) => `
        <label class="source-choice">
            <input type="checkbox" value="${s.value}">
            <span class="choice-box">
                <i data-lucide="${s.icon}"></i>
                <b>${s.label}</b>
                <em><i data-lucide="check"></i></em>
            </span>
        </label>
    `).join("");

    $("editProfileBtn").addEventListener("click", () => {

        $("businessName").value = profile.businessName;
        $("businessLocation").value = profile.location;

        const select = $("businessCategory");

        if (profile.businessCategory &&
            ![...select.options].some((o) => o.value === profile.businessCategory)) {
            select.add(new Option(profile.businessCategory, profile.businessCategory));
        }

        select.value = profile.businessCategory;

        document.querySelectorAll("#sourceChoices input").forEach((box) => {
            box.checked = profile.powerSources.includes(box.value);
        });

        showError("profileError", "");

        $("profileModal").classList.add("show");

        refreshIcons();

    });

    $("profileForm").addEventListener("submit", (event) => {

        event.preventDefault();

        const businessName = $("businessName").value.trim();
        const businessCategory = $("businessCategory").value;
        const location = $("businessLocation").value.trim();

        const powerSources = [...document.querySelectorAll("#sourceChoices input:checked")]
            .map((box) => box.value);

        if (!businessName) return showError("profileError", "Please enter your business name.");
        if (!businessCategory) return showError("profileError", "Please choose a business category.");
        if (powerSources.length === 0) return showError("profileError", "Select at least one power source.");

        profile.businessName = businessName;
        profile.businessCategory = businessCategory;
        profile.location = location;
        profile.powerSources = powerSources;

        saveBusiness();
        renderAll();

        $("profileModal").classList.remove("show");

        showToast("Business profile updated successfully!");

    });


    // =====================================
    // 7. CHANGE PASSWORD (checks the form only; the real change comes with the backend)
    // =====================================

    $("changePasswordBtn").addEventListener("click", () => {

        $("passwordForm").reset();
        showError("passwordError", "");
        $("passwordModal").classList.add("show");

    });

    $("passwordForm").addEventListener("submit", (event) => {

        event.preventDefault();

        const current = $("currentPassword").value;
        const next = $("newPassword").value;
        const confirm = $("confirmPassword").value;

        if (!current || !next || !confirm) return showError("passwordError", "Please complete all password fields.");
        if (next.length < 8) return showError("passwordError", "Your new password must have at least 8 characters.");
        if (next !== confirm) return showError("passwordError", "Your new passwords do not match.");

        // Never store passwords in the browser. The real change is done by the backend later.
        $("passwordModal").classList.remove("show");
        $("passwordForm").reset();

        showToast("Looks good. Changing the password will work once the backend is connected.");

    });


    // =====================================
    // 8. NOTIFICATION SWITCHES
    // =====================================

    const emailToggle = $("emailToggle");
    const appToggle = $("appToggle");

    const savedEmail = localStorage.getItem("pgEmailNotifications");
    const savedApp = localStorage.getItem("pgAppNotifications");

    if (savedEmail !== null) emailToggle.checked = savedEmail === "true";
    if (savedApp !== null) appToggle.checked = savedApp === "true";

    emailToggle.addEventListener("change", () => {

        localStorage.setItem("pgEmailNotifications", emailToggle.checked);

        showToast(emailToggle.checked ? "Email notifications enabled." : "Email notifications disabled.");

    });

    appToggle.addEventListener("change", () => {

        localStorage.setItem("pgAppNotifications", appToggle.checked);

        showToast(appToggle.checked ? "In-app notifications enabled." : "In-app notifications disabled.");

    });


    // =====================================
    // 9. CLOSE MODALS
    // =====================================

    function closeModal(modal) {
        modal.classList.remove("show");
    }

    document.querySelectorAll("[data-close]").forEach((button) => {
        button.addEventListener("click", () => closeModal($(button.dataset.close)));
    });

    document.querySelectorAll(".modal-overlay").forEach((overlay) => {
        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) closeModal(overlay);
        });
    });

    document.addEventListener("keydown", (event) => {

        if (event.key === "Escape") {
            document.querySelectorAll(".modal-overlay.show").forEach(closeModal);
        }

    });


    // =====================================
    // 10. START
    // =====================================

    renderAll();

});