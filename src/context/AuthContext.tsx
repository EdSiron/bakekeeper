"use client";
import { createContext, useContext, useState, useEffect } from "react";

type AuthContextType = {
  authed: boolean;
  setAuthed: (v: boolean) => void;
};

export const AuthContext = createContext<AuthContextType>({
  authed: false,
  setAuthed: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authed, setAuthedState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("cozy_admin_authed");
    if (stored === "true") {
      setAuthedState(true);
    }
    setReady(true);
  }, []);

  function setAuthed(value: boolean) {
    setAuthedState(value);
    if (value) {
      sessionStorage.setItem("cozy_admin_authed", "true");
    } else {
      sessionStorage.removeItem("cozy_admin_authed");
    }
  }

  if (!ready) return null;

  return (
    <AuthContext.Provider value={{ authed, setAuthed }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}