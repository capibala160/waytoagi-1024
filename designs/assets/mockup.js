// 设计稿的两个真实交互：主题切换、390/430 宽度切换。
// 手机里的按钮是视觉元素，不是可交互控件。

const root = document.documentElement;

const themeButtons = document.querySelectorAll("[data-theme-set]");
const widthButtons = document.querySelectorAll("[data-width-set]");

function syncTheme(theme) {
  root.dataset.theme = theme;
  themeButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.themeSet === theme);
    btn.setAttribute("aria-pressed", String(btn.dataset.themeSet === theme));
  });
}

function syncWidth(width) {
  root.dataset.width = width;
  widthButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.widthSet === width);
    btn.setAttribute("aria-pressed", String(btn.dataset.widthSet === width));
  });

  const size = width === "430" ? "430 × 932" : "390 × 844";
  document.querySelectorAll("[data-size-label]").forEach((el) => {
    el.textContent = size;
  });
}

themeButtons.forEach((btn) => {
  btn.addEventListener("click", () => syncTheme(btn.dataset.themeSet));
});

widthButtons.forEach((btn) => {
  btn.addEventListener("click", () => syncWidth(btn.dataset.widthSet));
});

const params = new URLSearchParams(location.search);
const initialTheme = params.get("theme") === "light"
  ? "light"
  : params.get("theme") === "dark"
    ? "dark"
    : (root.dataset.theme || "dark");
const initialWidth = params.get("width") === "430" ? "430" : "390";

syncTheme(initialTheme);
syncWidth(initialWidth);
