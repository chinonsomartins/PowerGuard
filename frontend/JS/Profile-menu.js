/* =========================================
   POWERGUARD PROFILE DROPDOWN (Settings / Log Out)
=========================================

   Add this file to every page and the user area at the top right becomes a
   dropdown with "Settings" and "Log Out". You do NOT change any HTML inside
   the page: this script finds the avatar and attaches the menu to it.

   On each page add:
     in <head>        <link rel="stylesheet" href="...profile-menu.css">
     before </body>   <script src="...profile-menu.js"
                              data-settings="Setting.html"
                              data-login="index.html"></script>

   data-settings = the file name of your Settings page
   data-login    = the file name of your login page
   (If you leave them out, the two names above are used.)
*/

(function () {

    // ---- the two page names (set in the <script> tag, see above) ----
    const tag = document.currentScript;

    const SETTINGS_PAGE = (tag && tag.dataset.settings) || "Setting.html";
    const LOGIN_PAGE = (tag && tag.dataset.login) || "index.html";


    function start() {

        // 1. find the user area
        const avatar = document.getElementById("profileAvatar") || document.querySelector(".avatar");

        if (!avatar) return;

        const container = avatar.closest(".user-area, .profile, .topbar-actions, .navbar-right, .user-profile") ||
            avatar.parentElement;

        if (getComputedStyle(container).position === "static") {
            container.style.position = "relative";
        }


        // 2. what the user can click to open the menu
        const wrappingButton = avatar.closest("button");

        const nameBlock = container.querySelector(".user-info, .profile-info, .profile-copy, .user-details");
        const arrow = container.querySelector(".lucide-chevron-down, [data-lucide='chevron-down'], .chevron, .profile-arrow");

        const triggers = wrappingButton
            ? [wrappingButton]
            : [avatar, nameBlock, arrow].filter(Boolean);


        // 3. build the menu
        const menu = document.createElement("div");

        menu.className = "pg-menu";
        menu.setAttribute("role", "menu");

        menu.innerHTML = `
            <a class="pg-menu-item" href="${SETTINGS_PAGE}" role="menuitem">
                <span class="pg-menu-icon"><i data-lucide="settings"></i></span>
                <span class="pg-menu-label">Settings</span>
                <i data-lucide="chevron-right" class="pg-menu-arrow"></i>
            </a>

            <div class="pg-menu-divider"></div>

            <button class="pg-menu-item" type="button" role="menuitem" data-logout>
                <span class="pg-menu-icon"><i data-lucide="log-out"></i></span>
                <span class="pg-menu-label">Log Out</span>
            </button>
        `;

        container.appendChild(menu);

        if (window.lucide) lucide.createIcons();


        // 4. open and close
        function setOpen(open) {

            menu.classList.toggle("open", open);
            container.classList.toggle("pg-open", open);

            triggers.forEach((el) => el.setAttribute("aria-expanded", open ? "true" : "false"));

        }

        triggers.forEach((el) => {

            el.classList.add("pg-menu-trigger");
            el.setAttribute("aria-haspopup", "menu");
            el.setAttribute("aria-expanded", "false");

            // avatar / name / arrow are not buttons, so make them keyboard friendly
            if (el.tagName !== "BUTTON") {
                el.setAttribute("role", "button");
                el.setAttribute("tabindex", "0");
            }

            el.addEventListener("click", () => setOpen(!menu.classList.contains("open")));

            el.addEventListener("keydown", (event) => {

                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setOpen(!menu.classList.contains("open"));
                }

            });

        });

        // clicking anywhere else closes it
        document.addEventListener("click", (event) => {

            const inside = menu.contains(event.target) ||
                triggers.some((el) => el.contains(event.target));

            if (!inside) setOpen(false);

        });

        document.addEventListener("keydown", (event) => {

            if (event.key === "Escape" && menu.classList.contains("open")) {
                setOpen(false);
                triggers[0].focus();
            }

        });


        // 5. Log Out
        menu.querySelector("[data-logout]").addEventListener("click", async () => {

            // Sign out of Firebase, otherwise the session survives and the next page signs you back in.
            try {
                const { auth } = await import("../firebase-config.js");
                const { signOut } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js");
                await signOut(auth);
            } catch (error) {
                console.error(error);
            }

            // forget the temporary details kept in this browser
            localStorage.removeItem("powerguardUser");
            localStorage.removeItem("powerguardToken");
            sessionStorage.removeItem("powerguardBusinessSetup");

            window.location.href = LOGIN_PAGE;

        });

    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }

})();