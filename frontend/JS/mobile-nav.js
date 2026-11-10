(function () {

  const PAGES = [
    { href: "Dashbroad.html", label: "Overview", icon: "house" },
    { href: "Expense.html", label: "Expenses", icon: "receipt-text" },
    { href: "Generator.html", label: "Generator", icon: "plug-zap" },
    { href: "Battery.html", label: "Battery", icon: "battery-charging" },
    { href: "Compare.html", label: "Compare", icon: "scale" },
    { href: "Setting.html", label: "Settings", icon: "settings" }
  ];

  function start() {

    // Only the signed-in app pages have a sidebar; skip anything else.
    if (!document.getElementById("sidebar") || document.querySelector(".pg-bottom-nav")) return;

    const current = location.pathname.split("/").pop().toLowerCase();

    const nav = document.createElement("nav");
    nav.className = "pg-bottom-nav";
    nav.setAttribute("aria-label", "Main navigation");

    nav.innerHTML = PAGES.map((page) => {
      const active = page.href.toLowerCase() === current;
      return `<a href="${page.href}" class="${active ? "active" : ""}"${active ? ' aria-current="page"' : ""}>
                <i data-lucide="${page.icon}"></i>
                <span>${page.label}</span>
              </a>`;
    }).join("");

    document.body.appendChild(nav);

    if (window.lucide) lucide.createIcons();

  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

})();