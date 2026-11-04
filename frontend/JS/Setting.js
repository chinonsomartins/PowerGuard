
/* =========================================
   POWERGUARD SETTINGS - M1 JAVASCRIPT
========================================= */

document.addEventListener("DOMContentLoaded", function () {

    // Initialize Lucide icons
    if (window.lucide) {
        lucide.createIcons();
    }


    // =====================================
    // ELEMENTS
    // =====================================

    const sidebar = document.getElementById("sidebar");
    const menuBtn = document.getElementById("menuBtn");
    const closeSidebar = document.getElementById("closeSidebar");
    const sidebarOverlay = document.getElementById("sidebarOverlay");

    const profileModal = document.getElementById("profileModal");
    const passwordModal = document.getElementById("passwordModal");

    const editProfileBtn = document.getElementById("editProfileBtn");

    const profileForm = document.getElementById("profileForm");
    const passwordForm = document.getElementById("passwordForm");

    const emailToggle = document.getElementById("emailToggle");
    const appToggle = document.getElementById("appToggle");

    const toast = document.getElementById("toast");


    // =====================================
    // BUSINESS PROFILE DATA
    // =====================================

    let businessProfile = {

        name: "Victory Salon",

        location: "Awka, Anambra State, Nigeria",

        category: "Barbing Salon",

        email: "victory.salon@example.com"

    };


    // =====================================
    // TOAST NOTIFICATION
    // =====================================

    let toastTimer;

    function showToast(message) {

        toast.textContent = message;

        toast.classList.add("show");

        clearTimeout(toastTimer);

        toastTimer = setTimeout(function () {

            toast.classList.remove("show");

        }, 3000);

    }


    // =====================================
    // MOBILE SIDEBAR
    // =====================================

    function openSidebar() {

        sidebar.classList.add("open");

        sidebarOverlay.classList.add("show");

    }


    function closeSidebarMenu() {

        sidebar.classList.remove("open");

        sidebarOverlay.classList.remove("show");

    }


    if (menuBtn) {

        menuBtn.addEventListener("click", openSidebar);

    }


    if (closeSidebar) {

        closeSidebar.addEventListener("click", closeSidebarMenu);

    }


    if (sidebarOverlay) {

        sidebarOverlay.addEventListener("click", closeSidebarMenu);

    }


    // Close sidebar when navigation links are clicked

    document.querySelectorAll(".nav-link").forEach(function (link) {

        link.addEventListener("click", closeSidebarMenu);

    });


    // Close sidebar if screen becomes desktop size

    window.addEventListener("resize", function () {

        if (window.innerWidth > 768) {

            closeSidebarMenu();

        }

    });


    // =====================================
    // SETTINGS NAVIGATION
    // =====================================

    const settingsTabs = document.querySelectorAll(".settings-tab");

    settingsTabs.forEach(function (tab) {

        tab.addEventListener("click", function () {

            // Remove active state from all tabs

            settingsTabs.forEach(function (item) {

                item.classList.remove("active");

            });


            // Activate clicked tab

            tab.classList.add("active");


            // Find the section

            const sectionId = tab.dataset.section;

            const targetSection = document.getElementById(sectionId);


            if (targetSection) {

                targetSection.scrollIntoView({

                    behavior: "smooth",

                    block: "start"

                });

            }

        });

    });


    // =====================================
    // UPDATE BUSINESS PROFILE DISPLAY
    // =====================================

    function updateBusinessDisplay() {

        document.getElementById("displayBusinessName").textContent =
            businessProfile.name;

        document.getElementById("displayLocation").textContent =
            businessProfile.location;

        document.getElementById("displayCategory").textContent =
            businessProfile.category;

        document.getElementById("navBusiness").textContent =
            businessProfile.name;

        document.getElementById("displayEmail").textContent =
            businessProfile.email;

    }


    // =====================================
    // OPEN EDIT PROFILE MODAL
    // =====================================

    editProfileBtn.addEventListener("click", function () {

        document.getElementById("businessName").value =
            businessProfile.name;

        document.getElementById("businessLocation").value =
            businessProfile.location;

        document.getElementById("businessCategory").value =
            businessProfile.category;

        profileModal.classList.add("show");

    });


    // =====================================
    // SAVE BUSINESS PROFILE
    // =====================================

    profileForm.addEventListener("submit", function (event) {

        event.preventDefault();


        const name =
            document.getElementById("businessName").value.trim();

        const location =
            document.getElementById("businessLocation").value.trim();

        const category =
            document.getElementById("businessCategory").value;


        if (!name || !location || !category) {

            showToast("Please complete all business information.");

            return;

        }


        // Update frontend profile data

        businessProfile.name = name;

        businessProfile.location = location;

        businessProfile.category = category;


        // Refresh page display

        updateBusinessDisplay();


        // Close modal

        closeModal(profileModal);


        showToast("Business profile updated successfully!");

    });


    // =====================================
    // OPEN PASSWORD MODAL
    // =====================================

    document.getElementById("changePasswordBtn")
        .addEventListener("click", function () {

            passwordForm.reset();

            passwordModal.classList.add("show");

        });


    // =====================================
    // PASSWORD VALIDATION
    // =====================================

    passwordForm.addEventListener("submit", function (event) {

        event.preventDefault();


        const currentPassword =
            document.getElementById("currentPassword").value;

        const newPassword =
            document.getElementById("newPassword").value;

        const confirmPassword =
            document.getElementById("confirmPassword").value;


        if (!currentPassword || !newPassword || !confirmPassword) {

            showToast("Please complete all password fields.");

            return;

        }


        if (newPassword.length < 8) {

            showToast("Password must contain at least 8 characters.");

            return;

        }


        if (newPassword !== confirmPassword) {

            showToast("Your new passwords do not match.");

            return;

        }


        /*
          FRONTEND M1 ONLY

          Actual password changes must be handled
          by the backend authentication system.

          Do not store passwords in localStorage.
        */

        showToast(
            "Validation successful. Backend connection is required to change your password."
        );

        closeModal(passwordModal);

        passwordForm.reset();

    });


    // =====================================
    // CLOSE MODALS
    // =====================================

    function closeModal(modal) {

        modal.classList.remove("show");

    }


    document.querySelectorAll("[data-close]").forEach(function (button) {

        button.addEventListener("click", function () {

            const modalId = button.dataset.close;

            const modal = document.getElementById(modalId);

            if (modal) {

                closeModal(modal);

            }

        });

    });


    // Close when clicking outside modal

    document.querySelectorAll(".modal-overlay").forEach(function (overlay) {

        overlay.addEventListener("click", function (event) {

            if (event.target === overlay) {

                closeModal(overlay);

            }

        });

    });


    // Close modal using Escape

    document.addEventListener("keydown", function (event) {

        if (event.key === "Escape") {

            document.querySelectorAll(".modal-overlay.show")
                .forEach(function (modal) {

                    closeModal(modal);

                });

        }

    });


    // =====================================
    // NOTIFICATION PREFERENCES
    // =====================================

    // Load saved preferences

    const savedEmail = localStorage.getItem("pgEmailNotifications");

    const savedApp = localStorage.getItem("pgAppNotifications");


    if (savedEmail !== null) {

        emailToggle.checked = savedEmail === "true";

    }


    if (savedApp !== null) {

        appToggle.checked = savedApp === "true";

    }


    // Email notifications

    emailToggle.addEventListener("change", function () {

        localStorage.setItem(
            "pgEmailNotifications",
            emailToggle.checked
        );


        showToast(

            emailToggle.checked
                ? "Email notifications enabled."
                : "Email notifications disabled."

        );

    });


    // In-app notifications

    appToggle.addEventListener("change", function () {

        localStorage.setItem(
            "pgAppNotifications",
            appToggle.checked
        );


        showToast(

            appToggle.checked
                ? "In-app notifications enabled."
                : "In-app notifications disabled."

        );

    });


    // =====================================
    // INITIALIZE PAGE
    // =====================================

    updateBusinessDisplay();

    console.log("PowerGuard Settings page loaded successfully.");

});
