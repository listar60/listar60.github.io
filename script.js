const menu = document.querySelector(".mobile-menu");
const menuToggle = menu.querySelector("summary");
const desktop = window.matchMedia("(min-width: 1024px)");

function syncMenu() {
  menuToggle.setAttribute("aria-expanded", String(menu.open));
  menuToggle.setAttribute("aria-label", menu.open ? "Close menu" : "Open menu");
  document.body.classList.toggle("menu-open", menu.open && !desktop.matches);
}

function closeMenu({ returnFocus = false } = {}) {
  menu.open = false;
  syncMenu();
  if (returnFocus) menuToggle.focus();
}

menu.addEventListener("toggle", syncMenu);
menu.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => closeMenu());
});

document.addEventListener("keydown", (event) => {
  if (!menu.open) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeMenu({ returnFocus: true });
  }
  if (event.key === "Tab") {
    const focusable = [menuToggle, ...menu.querySelectorAll("a")];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

desktop.addEventListener("change", () => {
  if (desktop.matches) closeMenu();
});

document.querySelectorAll("[data-year]").forEach((element) => {
  element.textContent = String(new Date().getFullYear());
});

syncMenu();
