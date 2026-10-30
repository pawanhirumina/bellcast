"use client";

/* eslint-disable react-hooks/set-state-in-effect -- reads the saved theme after hydration */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyTheme,
  readTheme,
  type ResolvedTheme,
  type ThemeChoice,
} from "@/lib/theme";

type ThemeContextValue = {
  choice: ThemeChoice;
  resolved: ResolvedTheme;
  setChoice: (choice: ThemeChoice) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  choice: "dark",
  resolved: "dark",
  setChoice: () => undefined,
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>("dark");

  useEffect(() => {
    const stored = readTheme();
    setChoiceState(stored);
    applyTheme(stored);
  }, []);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    applyTheme(next);
  }, []);

  const value = useMemo(
    () => ({ choice, resolved: choice, setChoice }),
    [choice, setChoice],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
