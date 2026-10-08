"use client";

import { useEffect, useState } from "react";

const THEME_KEY = "typeform-builder-creator-theme";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_KEY) === "dark";
    setDark(saved);
    document.documentElement.classList.toggle("creator-dark", saved);
    return () => document.documentElement.classList.remove("creator-dark");
  }, []);

  const toggle = () => {
    setDark((current) => {
      const next = !current;
      document.documentElement.classList.toggle("creator-dark", next);
      window.localStorage.setItem(THEME_KEY, next ? "dark" : "light");
      return next;
    });
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
    >
      <span aria-hidden>{dark ? "☀" : "◐"}</span>
      {dark ? "Light" : "Dark"}
    </button>
  );
}
