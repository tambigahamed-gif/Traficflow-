import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { isAppMode, type AppMode } from "@/lib/app-mode";

const STORAGE_KEY = "trafficflow_app_mode_v1";

type AppModeContextValue = {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
};

const AppModeContext = createContext<AppModeContextValue | null>(null);

function readInitialMode(): AppMode {
  if (typeof window === "undefined") return "professional";
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isAppMode(value) ? value : "professional";
  } catch {
    return "professional";
  }
}

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>(readInitialMode);
  const setMode = useCallback((nextMode: AppMode) => {
    setModeState(nextMode);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextMode);
    } catch {
      // The current session still changes mode when local storage is unavailable.
    }
  }, []);
  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
}

export function useAppMode() {
  const context = useContext(AppModeContext);
  if (!context) throw new Error("useAppMode doit être utilisé dans AppModeProvider.");
  return context;
}
