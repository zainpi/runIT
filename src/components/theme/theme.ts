export type Theme = "light" | "dark";
export const THEME_STORAGE_KEY = "runsit-theme-v1";

// Run before the page paints so a saved dark preference never flashes light.
export const themeInitScript = `(function(){var choice;try{choice=localStorage.getItem("${THEME_STORAGE_KEY}")}catch(e){}document.documentElement.dataset.theme=choice==="light"||choice==="dark"?choice:window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"})();`;
