/** localStorage key for the saved theme ("light" or "dark"). */
export const THEME_KEY = "kampasy-theme";

/**
 * Runs in <head> before first paint (see app/layout.tsx): applies the saved
 * theme, or the system preference when nothing is saved, so there is no flash.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;
