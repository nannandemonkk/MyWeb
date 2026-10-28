import { useEffect, useState } from "react";
import { SCENES, timeScene } from "../lib/appearance";

const STORAGE_KEY = "myweb.appearance.v1";

function readPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      mode: saved?.mode === "auto" || Object.hasOwn(SCENES, saved?.mode) ? saved.mode : "auto",
      particles: saved?.particles !== false,
    };
  } catch {
    return { mode: "auto", particles: true };
  }
}

export function useAppearance() {
  const [preferences, setPreferences] = useState(readPreferences);
  const [now, setNow] = useState(() => new Date());
  const scene = preferences.mode === "auto" ? timeScene(now) : preferences.mode;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.scene = scene;
    document.documentElement.dataset.particles = preferences.particles ? "on" : "off";
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // A blocked/full browser store must not prevent appearance controls from working.
    }
  }, [preferences, scene]);

  return {
    ...preferences,
    scene,
    now,
    setMode: (mode) => {
      if (mode === "auto" || Object.hasOwn(SCENES, mode)) {
        setPreferences((previous) => ({ ...previous, mode }));
      }
    },
    setParticles: (particles) => setPreferences((previous) => ({ ...previous, particles })),
  };
}
