import { requireUser } from "./session.js";
// ==========================================
// POWERGUARD - BUSINESS SETUP JAVASCRIPT
// ==========================================


// 1. SELECT HTML ELEMENTS

const powerOptions = document.querySelectorAll(".power-option");
const form = document.getElementById("businessSetup");
const toast = document.getElementById("toast");
const menuToggle = document.getElementById("menuToggle");
const sidebar = document.getElementById("sidebar");

const profileName = document.getElementById("profileName");
const profileAvatar = document.getElementById("profileAvatar");
const profileBusiness = document.getElementById("profileBusiness");
const businessNameInput = document.getElementById("businessName");

const API_BASE = "http://127.0.0.1:8000";


// ==========================================
// 2. USER PROFILE (name + initials)
// ==========================================
let currentUser = null;

function getSavedUser() {

    if (!currentUser) {
        return null;
    }

    return {
        fullName: currentUser.displayName || (currentUser.email || "").split("@")[0],
        email: currentUser.email
    };

}


function getInitials(fullName) {

    const parts = fullName.trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) {

        return "U";

    }

    const first = parts[0][0];

    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";

    return (first + last).toUpperCase();

}


function renderProfile() {
    
    const user = getSavedUser();

    if (user && user.fullName) {

        profileName.textContent = user.fullName;

        profileAvatar.textContent = getInitials(user.fullName);

    }

    // Business name shown under the user's name
    const savedSetup = JSON.parse(
        sessionStorage.getItem("powerguardBusinessSetup") || "null"
    );

    if (savedSetup && savedSetup.businessName) {

        profileBusiness.textContent = savedSetup.businessName;

    }

}

currentUser = await requireUser();

renderProfile();


// Update the business name under the profile while the user types it

businessNameInput.addEventListener("input", () => {

    const typed = businessNameInput.value.trim();

    profileBusiness.textContent = typed || "Set up your business";

});


// ==========================================
// 3. STORE SELECTED POWER SOURCES
// ==========================================

const selectedSources = new Set();

powerOptions.forEach((option) => {

    option.addEventListener("click", () => {

        const source = option.dataset.source;

        if (selectedSources.has(source)) {

            selectedSources.delete(source);

            option.classList.remove("selected");

            option.setAttribute("aria-pressed", "false");

        } else {

            selectedSources.add(source);

            option.classList.add("selected");

            option.setAttribute("aria-pressed", "true");

        }

        document.getElementById("powerError").textContent = "";

    });

});


// ==========================================
// 4. NOTIFICATION MESSAGE
// ==========================================

function showToast(message) {

    toast.textContent = message;

    toast.classList.add("show");

    window.setTimeout(() => {

        toast.classList.remove("show");

    }, 3000);

}


// ==========================================
// 5. CLEAR FORM ERRORS
// ==========================================

function clearErrors() {

    document.getElementById("businessNameError").textContent = "";

    document.getElementById("businessCategoryError").textContent = "";

    document.getElementById("powerError").textContent = "";

    document.getElementById("hoursPerDayError").textContent = "";

    document.getElementById("daysPerMonthError").textContent = "";

}


// ==========================================
// 6. HANDLE FORM SUBMISSION
// ==========================================

form.addEventListener("submit", async (event) => {

    event.preventDefault();

    clearErrors();

    const businessName = businessNameInput.value.trim();

    const businessCategory = document
        .getElementById("businessCategory")
        .value;

    const location = document
        .getElementById("location")
        .value.trim();

        const hoursPerDay = parseFloat(document.getElementById("hoursPerDay").value);
        const daysPerMonth = parseFloat(document.getElementById("daysPerMonth").value);

    let valid = true;

    if (!businessName) {

        document.getElementById("businessNameError").textContent =
            "Please enter your business name.";

        valid = false;

    }

    if (!businessCategory) {

        document.getElementById("businessCategoryError").textContent =
            "Please select a business category.";

        valid = false;

    }

        if (!(hoursPerDay > 0 && hoursPerDay <= 24)) {

        document.getElementById("hoursPerDayError").textContent =
            "Enter hours between 1 and 24.";

        valid = false;

    }

    if (!(daysPerMonth > 0 && daysPerMonth <= 31)) {

        document.getElementById("daysPerMonthError").textContent =
            "Enter days between 1 and 31.";

        valid = false;

    }

    if (selectedSources.size === 0) {

        document.getElementById("powerError").textContent =
            "Select at least one power source to continue.";

        valid = false;

    }

    if (!valid) {

        return;

    }

    // Collect business information

    const setupData = {

        businessName: businessName,

        businessCategory: businessCategory,

        location: location,

        powerSources: [...selectedSources]

    };

    // Save temporarily in the browser (backend will replace this)

    sessionStorage.setItem(
        "powerguardBusinessSetup",
        JSON.stringify(setupData)
    );

        const submitButton = form.querySelector('button[type="submit"]');

    submitButton.disabled = true;

    try {

        const response = await fetch(`${API_BASE}/api/v1/business`, {
            method: "PUT",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": "Bearer " + await currentUser.getIdToken()

            },
            body: JSON.stringify({
                name: businessName,
                type: businessCategory,
                location: location,
                power_sources: [...selectedSources],
                operating_hours_per_day: hoursPerDay,
                operating_days_per_month: daysPerMonth
            })
        });

        if (!response.ok) {
            throw new Error("API returned status " + response.status);
        }

    } catch (error) {

        console.error("Could not save business profile:", error);

        showToast("Could not save: " + error.message);

        submitButton.disabled = false;

        return;

    }

       profileBusiness.textContent = businessName;

    showToast("Business details saved! Taking you to your Expense page...");

    console.log("PowerGuard Business Setup:", setupData);

    // Wait 1 second so the user can see the message, then go to the dashboard
    window.setTimeout(() => {
        window.location.href = "Expense.html";
    }, 1000);

});




// ==========================================
// 7. BACK BUTTON
// ==========================================

document.getElementById("backButton").addEventListener("click", () => {

    showToast("Back navigation will be connected to the previous page.");

});


// ==========================================
// 8. MOBILE SIDEBAR MENU
// ==========================================

menuToggle.addEventListener("click", () => {

    sidebar.classList.toggle("open");

});

document.addEventListener("click", (event) => {

    if (

        window.innerWidth <= 820 &&

        sidebar.classList.contains("open") &&

        !sidebar.contains(event.target) &&

        !menuToggle.contains(event.target)

    ) {

        sidebar.classList.remove("open");

    }

});


// ==========================================
// 9. INITIALIZE LUCIDE ICONS
// ==========================================

if (window.lucide) {

    lucide.createIcons();

}


// ==========================================
// END OF POWERGUARD BUSINESS SETUP JAVASCRIPT
// ==========================================