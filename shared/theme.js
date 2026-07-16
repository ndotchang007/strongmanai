/**
 * Appearance themes — 5 palettes + System.
 * Each palette is 4 role colors: bg, surface, accent, highlight
 * (plus derived tokens for borders/text).
 *
 * Stored: dark | light | system | voltage | forge | aurora
 * document.documentElement[data-theme] is always concrete (never "system").
 */
(function () {
  var STORAGE_KEY = "strongman-home-theme";

  /**
   * Four swatches = [bg, surface, accent, highlight]
   * @type {ReadonlyArray<{ id: string, nickname: string, blurb: string, kind: 'dark'|'light'|'system', swatches: string[] }>}
   */
  var THEME_CATALOG = [
    {
      id: "dark",
      nickname: "Ember",
      blurb: "Charcoal floors, molten orange",
      kind: "dark",
      swatches: ["#141414", "#1e1e1e", "#ff8c00", "#ffa033"],
    },
    {
      id: "light",
      nickname: "Daylight",
      blurb: "Chalk floors, burnt orange",
      kind: "light",
      swatches: ["#f2f2f2", "#ffffff", "#b35300", "#c45c26"],
    },
    {
      id: "system",
      nickname: "System",
      blurb: "Follows your device setting",
      kind: "system",
      swatches: ["#141414", "#f2f2f2", "#ff8c00", "#b35300"],
    },
    {
      id: "voltage",
      nickname: "Voltage",
      blurb: "Deep navy, electric blue, neon lime",
      kind: "dark",
      swatches: ["#0a1628", "#132844", "#2f6bff", "#c8f542"],
    },
    {
      id: "forge",
      nickname: "Forge",
      blurb: "Steel black, copper heat, gold spark",
      kind: "dark",
      swatches: ["#100c0a", "#221a14", "#e85d04", "#ffba08"],
    },
    {
      id: "aurora",
      nickname: "Aurora",
      blurb: "Ink night, violet pulse, ice cyan",
      kind: "dark",
      swatches: ["#0c0a14", "#1a1730", "#a78bfa", "#67e8f9"],
    },
  ];

  var CONCRETE_IDS = {
    dark: true,
    light: true,
    voltage: true,
    forge: true,
    aurora: true,
  };

  var LEGACY_ALIASES = {
    tidepool: "aurora",
    "noir-lilac": "aurora",
    citrus: "voltage",
    marble: "light",
    auto: "system",
  };

  function normalizeStored(raw) {
    if (raw == null || raw === "") return "dark";
    var v = String(raw).toLowerCase().trim();
    if (LEGACY_ALIASES[v]) return LEGACY_ALIASES[v];
    if (v === "system" || CONCRETE_IDS[v]) return v;
    return "dark";
  }

  function getStoredTheme() {
    try {
      return normalizeStored(localStorage.getItem(STORAGE_KEY));
    } catch (e) {
      return "dark";
    }
  }

  function prefersDark() {
    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch (e) {
      return true;
    }
  }

  function resolveTheme(stored) {
    var s = normalizeStored(stored);
    if (s === "system") return prefersDark() ? "dark" : "light";
    return s;
  }

  function getEffectiveTheme() {
    return resolveTheme(getStoredTheme());
  }

  function catalogEntry(id) {
    var n = normalizeStored(id);
    for (var i = 0; i < THEME_CATALOG.length; i++) {
      if (THEME_CATALOG[i].id === n) return THEME_CATALOG[i];
    }
    return THEME_CATALOG[0];
  }

  function applyDocumentTheme() {
    var effective = getEffectiveTheme();
    document.documentElement.setAttribute("data-theme", effective);
    var entry = catalogEntry(effective);
    var scheme = entry && entry.kind === "light" ? "light" : "dark";
    document.documentElement.style.colorScheme = scheme;
  }

  function setThemePreference(id) {
    var next = normalizeStored(id);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {}
    applyDocumentTheme();
    try {
      window.dispatchEvent(
        new CustomEvent("strongman:themechange", {
          detail: { preference: next, effective: getEffectiveTheme() },
        })
      );
    } catch (e2) {}
  }

  applyDocumentTheme();

  try {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var onChange = function () {
      if (getStoredTheme() === "system") applyDocumentTheme();
    };
    if (typeof mq.addEventListener === "function") mq.addEventListener("change", onChange);
    else if (typeof mq.addListener === "function") mq.addListener(onChange);
  } catch (e) {}

  window.StrongmanTheme = {
    STORAGE_KEY: STORAGE_KEY,
    THEME_CATALOG: THEME_CATALOG,
    getStoredTheme: getStoredTheme,
    getEffectiveTheme: getEffectiveTheme,
    applyDocumentTheme: applyDocumentTheme,
    setThemePreference: setThemePreference,
    catalogEntry: catalogEntry,
  };

  window.getStoredTheme = getStoredTheme;
  window.getEffectiveTheme = getEffectiveTheme;
  window.applyDocumentTheme = applyDocumentTheme;
})();
