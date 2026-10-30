export type ThemeChoice = "light" | "dark";
export type ResolvedTheme = ThemeChoice;

export const THEME_STORAGE_KEY = "bellcast-theme";

export type ThemeOption = {
  id: ThemeChoice;
  label: string;
  note: string;
  swatch: { canvas: string; panel: string; accent: string };
};

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "light",
    label: "Light",
    note: "White canvas, aubergine",
    swatch: { canvas: "#ffffff", panel: "#f4f2f6", accent: "#611f69" },
  },
  {
    id: "dark",
    label: "Dark",
    note: "Slate canvas, green accent",
    swatch: { canvas: "#1a1d21", panel: "#19171d", accent: "#007a5a" },
  },
];

export function isThemeChoice(value: string | null): value is ThemeChoice {
  return value === "light" || value === "dark";
}

export function readTheme(): ThemeChoice {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(stored) ? stored : "dark";
  } catch {
    return "dark";
  }
}

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  return choice;
}

export function applyTheme(choice: ThemeChoice) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = choice;
  root.dataset.themeChoice = choice;
  root.style.colorScheme = choice;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Storage can be unavailable in private or embedded contexts.
  }
}

export const themeInitScript = `(function(){try{var c=localStorage.getItem("${THEME_STORAGE_KEY}");if(c!=="light")c="dark";document.documentElement.dataset.theme=c;document.documentElement.dataset.themeChoice=c;document.documentElement.style.colorScheme=c;}catch(e){document.documentElement.dataset.theme="dark";}})();`;
