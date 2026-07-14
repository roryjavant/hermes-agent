import type { DashboardTheme, ThemeTypography, ThemeLayout } from "./types";

/**
 * Built-in dashboard themes.
 *
 * Each theme defines its own palette, typography, and layout so switching
 * themes produces visible changes beyond just color — fonts, density, and
 * corner-radius all shift to match the theme's personality.
 *
 * Theme names must stay in sync with the backend's
 * `_BUILTIN_DASHBOARD_THEMES` list in `hermes_cli/web_server.py`.
 */

// ---------------------------------------------------------------------------
// Shared typography / layout presets
// ---------------------------------------------------------------------------

/** Default system stack — neutral, safe fallback for every platform. */
const SYSTEM_SANS =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const SYSTEM_MONO =
  'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace';

const DEFAULT_TYPOGRAPHY: ThemeTypography = {
  fontSans: SYSTEM_SANS,
  fontMono: SYSTEM_MONO,
  baseSize: "15px",
  lineHeight: "1.55",
  letterSpacing: "0",
};

const DEFAULT_LAYOUT: ThemeLayout = {
  radius: "0.5rem",
  density: "comfortable",
};

// ---------------------------------------------------------------------------
// Themes
// ---------------------------------------------------------------------------

export const defaultTheme: DashboardTheme = {
  name: "default",
  label: "Hermes Teal",
  description: "Classic dark teal — the canonical Hermes look",
  palette: {
    background: { hex: "#041c1c", alpha: 1 },
    midground: { hex: "#ffe6cb", alpha: 1 },
    foreground: { hex: "#ffffff", alpha: 0 },
    warmGlow: "rgba(255, 189, 56, 0.35)",
    noiseOpacity: 1,
  },
  typography: DEFAULT_TYPOGRAPHY,
  layout: DEFAULT_LAYOUT,
  terminalBackground: "#000000",
};

export const midnightTheme: DashboardTheme = {
  name: "midnight",
  label: "Midnight",
  description: "Deep blue-violet with cool accents",
  palette: {
    background: { hex: "#0a0a1f", alpha: 1 },
    midground: { hex: "#d4c8ff", alpha: 1 },
    foreground: { hex: "#ffffff", alpha: 0 },
    warmGlow: "rgba(167, 139, 250, 0.32)",
    noiseOpacity: 0.8,
  },
  typography: {
    ...DEFAULT_TYPOGRAPHY,
    fontSans: `"Inter", ${SYSTEM_SANS}`,
    fontMono: `"JetBrains Mono", ${SYSTEM_MONO}`,
    fontUrl:
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap",
    letterSpacing: "-0.005em",
  },
  layout: {
    ...DEFAULT_LAYOUT,
    radius: "0.75rem",
  },
};

export const emberTheme: DashboardTheme = {
  name: "ember",
  label: "Ember",
  description: "Warm crimson and bronze — forge vibes",
  palette: {
    background: { hex: "#1a0a06", alpha: 1 },
    midground: { hex: "#ffd8b0", alpha: 1 },
    foreground: { hex: "#ffffff", alpha: 0 },
    warmGlow: "rgba(249, 115, 22, 0.38)",
    noiseOpacity: 1,
  },
  typography: {
    ...DEFAULT_TYPOGRAPHY,
    fontSans: `"Spectral", Georgia, "Times New Roman", serif`,
    fontMono: `"IBM Plex Mono", ${SYSTEM_MONO}`,
    fontUrl:
      "https://fonts.googleapis.com/css2?family=Spectral:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;700&display=swap",
  },
  layout: {
    ...DEFAULT_LAYOUT,
    radius: "0.25rem",
  },
  colorOverrides: {
    destructive: "#c92d0f",
    warning: "#f97316",
  },
};

export const monoTheme: DashboardTheme = {
  name: "mono",
  label: "Mono",
  description: "Clean grayscale — minimal and focused",
  palette: {
    background: { hex: "#0e0e0e", alpha: 1 },
    midground: { hex: "#eaeaea", alpha: 1 },
    foreground: { hex: "#ffffff", alpha: 0 },
    warmGlow: "rgba(255, 255, 255, 0.1)",
    noiseOpacity: 0.6,
  },
  typography: {
    ...DEFAULT_TYPOGRAPHY,
    fontSans: `"IBM Plex Sans", ${SYSTEM_SANS}`,
    fontMono: `"IBM Plex Mono", ${SYSTEM_MONO}`,
    fontUrl:
      "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap",
  },
  layout: {
    ...DEFAULT_LAYOUT,
    radius: "0",
  },
};

export const cyberpunkTheme: DashboardTheme = {
  name: "cyberpunk",
  label: "Cyberpunk",
  description: "Neon green on black — matrix terminal",
  palette: {
    background: { hex: "#040608", alpha: 1 },
    midground: { hex: "#9bffcf", alpha: 1 },
    foreground: { hex: "#ffffff", alpha: 0 },
    warmGlow: "rgba(0, 255, 136, 0.22)",
    noiseOpacity: 1.2,
  },
  typography: {
    ...DEFAULT_TYPOGRAPHY,
    fontSans: `"Share Tech Mono", "JetBrains Mono", ${SYSTEM_MONO}`,
    fontMono: `"Share Tech Mono", "JetBrains Mono", ${SYSTEM_MONO}`,
    fontUrl:
      "https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=JetBrains+Mono:wght@400;700&display=swap",
  },
  layout: {
    ...DEFAULT_LAYOUT,
    radius: "0",
  },
  colorOverrides: {
    success: "#00ff88",
    warning: "#ffd700",
    destructive: "#ff0055",
  },
};

export const roseTheme: DashboardTheme = {
  name: "rose",
  label: "Rosé",
  description: "Soft pink and warm ivory — easy on the eyes",
  palette: {
    background: { hex: "#1a0f15", alpha: 1 },
    midground: { hex: "#ffd4e1", alpha: 1 },
    foreground: { hex: "#ffffff", alpha: 0 },
    warmGlow: "rgba(249, 168, 212, 0.3)",
    noiseOpacity: 0.9,
  },
  typography: {
    ...DEFAULT_TYPOGRAPHY,
    fontSans: `"Fraunces", Georgia, serif`,
    fontMono: `"DM Mono", ${SYSTEM_MONO}`,
    fontUrl:
      "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=DM+Mono:wght@400;500&display=swap",
  },
  layout: {
    ...DEFAULT_LAYOUT,
    radius: "1rem",
  },
};

/**
 * Nous Blue — the inverted "light mode" Hermes look, ported from the
 * LENS_5I overlay preset in `@nous-research/ui`.
 *
 * Unlike the other built-ins (which paint dark color directly on the
 * canvas), this theme relies on `<Backdrop />`'s foreground inversion
 * layer: an opaque white sheet at z-200 with `mix-blend-mode: difference`
 * that flips the entire stack below it. Authoring colors stay dark
 * (`#170d02` brown background, `#FFAC02` orange midground), and the
 * inversion converts them to their visual complements at paint time —
 * the orange midground reads as #0053FD Nous-blue on screen, against a
 * cream `#E8F2FD` canvas.
 *
 * Note on bg blend mode: the DS Lens uses `multiply` for LENS_5I because
 * nousnet-web's <body> is white; hermes-agent's App root is `bg-black`,
 * so we leave the bg layer's blend mode at the `difference` default —
 * `difference(#170d02, #000)` passes the bg through unchanged, and the
 * subsequent FG-difference layer then inverts it to cream. Using
 * `multiply` here would collapse the bg to pure black against the
 * `bg-black` root and produce a plain-white canvas instead of the
 * intended cream-blue.
 *
 * Source of truth for the palette: `design-language/src/ui/components/
 * overlays/lens.ts` (LENS_5I export).
 */
export const nousBlueTheme: DashboardTheme = {
  name: "nous-blue",
  label: "Nous Blue",
  description: "Light mode — vivid Nous-blue accents on cream canvas",
  palette: {
    background: { hex: "#170d02", alpha: 1 },
    midground: { hex: "#FFAC02", alpha: 1 },
    foreground: { hex: "#FFFFFF", alpha: 1 },
    // Same warm-amber as nousnet-web's overlay glow; after the FG
    // inversion it reads as a cool ultraviolet vignette in the top-left.
    warmGlow: "rgba(255, 172, 2, 0.18)",
    // Noise sits above the FG inversion and is NOT flipped, so a softer
    // multiplier keeps it from speckling over the bright post-inversion
    // canvas.
    noiseOpacity: 0.4,
  },
  typography: DEFAULT_TYPOGRAPHY,
  layout: DEFAULT_LAYOUT,
  // Inverted page: the embedded terminal is below the FG layer too, so
  // a `#000000` source paints as visual white — i.e. a proper light-mode
  // terminal pane. xterm picks lighter palette colors against the "black"
  // canvas, which then read as dark text on screen post-inversion.
  terminalBackground: "#000000",
  componentStyles: {
    backdrop: {
      // Lower than LENS_5I.Lens.fillerOpacity (0.06). The filler texture
      // gets amplified post-inversion: small variations against the deep
      // `#170d02` source bg are barely visible, but those same variations
      // against the bright `#E8F2FD` post-inversion canvas read as a
      // heavy cloud/marble pattern — especially on near-empty pages
      // (loading spinners, blank states). 0.02 keeps subtle grain
      // without overwhelming the canvas.
      fillerOpacity: "0.02",
    },
  },
  // Pre-invert absolute-hex tokens so they read as their familiar colors
  // through the FG difference layer. e.g. source #04D3C9 (cyan) is what
  // gets painted, and `255 - channel` flips it to #FB2C36 (red) on screen.
  // Without these, the default destructive/success/warning tokens would
  // appear as their unintuitive complements.
  colorOverrides: {
    destructive: "#04d3c9",
    destructiveForeground: "#000000",
    success: "#b5217f",
    warning: "#0042c7",
  },
  // Pre-inverted data-series accents for the Analytics/Models token
  // charts. The defaults (#ffe6cb cream + #34d399 emerald) would render
  // through the FG difference layer as dark navy + hot-coral on the
  // bright Nous-blue canvas — the coral is the "red" users see for
  // Output values without these overrides. Source → on-screen:
  //   Input:  #ffe6cb → #001934 (dark navy)        ← unchanged
  //   Output: #ffac02 → #0053fd (vivid Nous-blue)  ← brand accent
  // Input keeps the cream source so it stays a neutral, low-contrast
  // dark-blue against the cream canvas; output paints as the brand
  // Nous-blue so the "primary" series in token-flow charts reads as
  // the highlight color, matching the rest of the inverted UI chrome.
  seriesColors: {
    inputTokenAccent: "#ffe6cb",
    outputTokenAccent: "#ffac02",
  },
  // Explicit picker swatch — the raw palette hex (`#170d02`, `#FFAC02`,
  // amber rgba) doesn't reflect what users see after the FG inversion,
  // so we paint the post-inversion visual triplet directly:
  //   white → vivid Nous-blue → cream/light-blue
  // matching the actual on-screen rendering of the theme.
  swatchColors: ["#FFFFFF", "#0053FD", "#E8F2FD"],
};

export const missionControlTheme: DashboardTheme = {
  name: "mission-control",
  label: "Mission Control",
  description: "Black/orange cockpit command center inspired by Mission Control",
  palette: {
    background: { hex: "#020202", alpha: 1 },
    midground: { hex: "#fff7ed", alpha: 1 },
    foreground: { hex: "#ffffff", alpha: 0 },
    warmGlow: "rgba(255, 61, 0, 0.10)",
    noiseOpacity: 0.55,
  },
  typography: {
    ...DEFAULT_TYPOGRAPHY,
    fontSans: `"Inter", ${SYSTEM_SANS}`,
    fontMono: `"JetBrains Mono", ${SYSTEM_MONO}`,
    fontDisplay: `"Inter", ${SYSTEM_SANS}`,
    fontUrl:
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap",
    letterSpacing: "0.006em",
  },
  layout: {
    ...DEFAULT_LAYOUT,
    radius: "0.625rem",
    density: "compact",
  },
  terminalBackground: "#000000",
  colorOverrides: {
    card: "#030303",
    cardForeground: "#fff7ed",
    popover: "#050505",
    popoverForeground: "#fff7ed",
    primary: "#ff3d00",
    primaryForeground: "#020202",
    secondary: "rgba(255, 61, 0, 0.07)",
    secondaryForeground: "#fff7ed",
    muted: "rgba(255, 247, 237, 0.06)",
    mutedForeground: "rgba(255, 247, 237, 0.62)",
    accent: "rgba(255, 61, 0, 0.12)",
    accentForeground: "#ff7a3d",
    destructive: "#ff1200",
    destructiveForeground: "#ffffff",
    success: "#22d3ee",
    warning: "#ff3d00",
    border: "rgba(255, 61, 0, 0.22)",
    input: "rgba(255, 61, 0, 0.24)",
    ring: "#ff3d00",
  },
  seriesColors: {
    inputTokenAccent: "#ff7a3d",
    outputTokenAccent: "#22d3ee",
  },
  componentStyles: {
    backdrop: {
      fillerOpacity: "0.018",
      fillerBlendMode: "screen",
    },
    header: {
      background: "rgba(2, 2, 2, 0.96)",
      borderImage: "linear-gradient(90deg, rgba(255,61,0,0.42), rgba(255,61,0,0.10)) 1",
    },
    sidebar: {
      background: "rgba(2, 2, 2, 0.97)",
      borderImage: "linear-gradient(180deg, rgba(255,61,0,0.36), rgba(255,255,255,0.08), rgba(255,61,0,0.24)) 1",
    },
    page: {
      background: "#020202",
    },
  },
  customCSS: `
html,
body,
#root {
  background: #020202;
}

body {
  background-image:
    linear-gradient(rgba(255, 61, 0, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 61, 0, 0.035) 1px, transparent 1px),
    radial-gradient(circle at 78% 10%, rgba(255, 61, 0, 0.08), transparent 28rem);
  background-size: 48px 48px, 48px 48px, auto;
}

#app-sidebar {
  box-shadow: inset -1px 0 0 rgba(255, 61, 0, 0.16);
}

#app-sidebar nav a,
#app-sidebar button {
  font-family: var(--theme-font-mono);
  letter-spacing: 0.14em;
}

#app-sidebar nav a[aria-current="page"] {
  color: #ff3d00;
  background: rgba(255, 61, 0, 0.06);
}

#app-sidebar nav a[aria-current="page"]::after {
  content: "";
  position: absolute;
  right: 0.5rem;
  top: 50%;
  width: 0.34rem;
  height: 0.34rem;
  border-radius: 9999px;
  background: #ff3d00;
  transform: translateY(-50%);
  box-shadow: 0 0 14px rgba(255, 61, 0, 0.8);
}

.bg-card,
[class*="bg-card/"],
.bg-popover,
.bg-background-base\/70,
.bg-background-base\/80,
.bg-background-base\/90,
.bg-background-base\/95 {
  background-color: #030303 !important;
}

.border-border,
.border-current\/20,
.border-current\/15,
.border-current\/10 {
  border-color: rgba(255, 61, 0, 0.20) !important;
}

.shadow-2xl,
.shadow-xl,
.shadow-lg {
  box-shadow: none !important;
}

.rounded-2xl,
.rounded-3xl,
.rounded-xl {
  border-radius: 10px !important;
}

.text-success {
  color: #22d3ee !important;
}

.text-warning,
[class*="text-amber-"],
[class*="text-yellow-"] {
  color: #ff3d00 !important;
}

.text-destructive {
  color: #ff1200 !important;
}

[class*="border-amber-"],
[class*="border-yellow-"] {
  border-color: rgba(255, 61, 0, 0.36) !important;
}

[class*="bg-amber-"],
[class*="bg-yellow-"] {
  background-color: rgba(255, 61, 0, 0.10) !important;
}

.bg-success,
.bg-success\/15,
.bg-success\/20 {
  background-color: rgba(34, 211, 238, 0.12) !important;
}

.bg-warning,
.bg-warning\/15,
.bg-warning\/20 {
  background-color: rgba(255, 61, 0, 0.12) !important;
}

.bg-destructive,
.bg-destructive\/15,
.bg-destructive\/20 {
  background-color: rgba(255, 18, 0, 0.14) !important;
}

main,
[role="main"] {
  background: transparent;
}

button:focus-visible,
a:focus-visible,
input:focus-visible,
textarea:focus-visible,
select:focus-visible {
  outline-color: #ff3d00 !important;
  box-shadow: 0 0 0 1px rgba(255, 61, 0, 0.85) !important;
}
`,
  swatchColors: ["#020202", "#ff3d00", "#fff7ed"],
};


type MissionAccentPreset = {
  name: string;
  label: string;
  description: string;
  accent: string;
  accentRgb: string;
  ready: string;
  readyRgb: string;
  alert: string;
  alertRgb: string;
  ink?: string;
  inkRgb?: string;
};

function missionControlAccentTheme(preset: MissionAccentPreset): DashboardTheme {
  const ink = preset.ink ?? "#f8f3ff";
  const inkRgb = preset.inkRgb ?? "248, 243, 255";
  return {
    ...missionControlTheme,
    name: preset.name,
    label: preset.label,
    description: preset.description,
    palette: {
      background: { hex: "#020202", alpha: 1 },
      midground: { hex: ink, alpha: 1 },
      foreground: { hex: "#ffffff", alpha: 0 },
      warmGlow: `rgba(${preset.accentRgb}, 0.10)`,
      noiseOpacity: 0.55,
    },
    colorOverrides: {
      ...missionControlTheme.colorOverrides,
      cardForeground: ink,
      popoverForeground: ink,
      primary: preset.accent,
      primaryForeground: "#020202",
      secondary: `rgba(${preset.accentRgb}, 0.07)`,
      secondaryForeground: ink,
      muted: `rgba(${inkRgb}, 0.06)`,
      mutedForeground: `rgba(${inkRgb}, 0.62)`,
      accent: `rgba(${preset.accentRgb}, 0.12)`,
      accentForeground: preset.accent,
      destructive: preset.alert,
      success: preset.ready,
      warning: preset.accent,
      border: `rgba(${preset.accentRgb}, 0.22)`,
      input: `rgba(${preset.accentRgb}, 0.24)`,
      ring: preset.accent,
    },
    seriesColors: {
      inputTokenAccent: preset.accent,
      outputTokenAccent: preset.ready,
    },
    componentStyles: {
      ...missionControlTheme.componentStyles,
      header: {
        background: "rgba(2, 2, 2, 0.96)",
        borderImage: `linear-gradient(90deg, rgba(${preset.accentRgb},0.42), rgba(${preset.accentRgb},0.10)) 1`,
      },
      sidebar: {
        background: "rgba(2, 2, 2, 0.97)",
        borderImage: `linear-gradient(180deg, rgba(${preset.accentRgb},0.36), rgba(255,255,255,0.08), rgba(${preset.accentRgb},0.24)) 1`,
      },
    },
    customCSS: `
html,
body,
#root {
  background: #020202;
}

body {
  background-image:
    linear-gradient(rgba(${preset.accentRgb}, 0.040) 1px, transparent 1px),
    linear-gradient(90deg, rgba(${preset.accentRgb}, 0.030) 1px, transparent 1px),
    radial-gradient(circle at 78% 10%, rgba(${preset.accentRgb}, 0.07), transparent 28rem);
  background-size: 48px 48px, 48px 48px, auto;
}

.mission-control-surface {
  --mission-theme-accent: ${preset.accent};
  --mission-theme-accent-rgb: ${preset.accentRgb};
  --mission-theme-ready: ${preset.ready};
  --mission-theme-ready-rgb: ${preset.readyRgb};
  --mission-theme-running: ${preset.accent};
  --mission-theme-alert: ${preset.alert};
  --mission-theme-alert-rgb: ${preset.alertRgb};
  --mission-theme-ink: ${ink};
  --mission-theme-ink-rgb: ${inkRgb};
}

#app-sidebar {
  box-shadow: inset -1px 0 0 rgba(${preset.accentRgb}, 0.16);
}

#app-sidebar nav a,
#app-sidebar button {
  font-family: var(--theme-font-mono);
  letter-spacing: 0.14em;
}

#app-sidebar nav a[aria-current="page"] {
  color: ${preset.accent};
  background: rgba(${preset.accentRgb}, 0.06);
}

#app-sidebar nav a[aria-current="page"]::after {
  content: "";
  position: absolute;
  right: 0.5rem;
  top: 50%;
  width: 0.34rem;
  height: 0.34rem;
  border-radius: 9999px;
  background: ${preset.accent};
  transform: translateY(-50%);
  box-shadow: 0 0 14px rgba(${preset.accentRgb}, 0.8);
}

.bg-card,
[class*="bg-card/"],
.bg-popover,
.bg-background-base\/70,
.bg-background-base\/80,
.bg-background-base\/90,
.bg-background-base\/95 {
  background-color: #030303 !important;
}

.border-border,
.border-current\/20,
.border-current\/15,
.border-current\/10 {
  border-color: rgba(${preset.accentRgb}, 0.20) !important;
}

.shadow-2xl,
.shadow-xl,
.shadow-lg {
  box-shadow: none !important;
}

.rounded-2xl,
.rounded-3xl,
.rounded-xl {
  border-radius: 10px !important;
}

.text-success {
  color: ${preset.ready} !important;
}

.text-warning,
[class*="text-amber-"],
[class*="text-yellow-"] {
  color: ${preset.accent} !important;
}

.text-destructive {
  color: ${preset.alert} !important;
}

[class*="border-amber-"],
[class*="border-yellow-"] {
  border-color: rgba(${preset.accentRgb}, 0.36) !important;
}

[class*="bg-amber-"],
[class*="bg-yellow-"] {
  background-color: rgba(${preset.accentRgb}, 0.10) !important;
}

.bg-success,
.bg-success\/15,
.bg-success\/20 {
  background-color: rgba(${preset.readyRgb}, 0.12) !important;
}

.bg-warning,
.bg-warning\/15,
.bg-warning\/20 {
  background-color: rgba(${preset.accentRgb}, 0.12) !important;
}

.bg-destructive,
.bg-destructive\/15,
.bg-destructive\/20 {
  background-color: rgba(${preset.alertRgb}, 0.14) !important;
}

main,
[role="main"] {
  background: transparent;
}

button:focus-visible,
a:focus-visible,
input:focus-visible,
textarea:focus-visible,
select:focus-visible {
  outline-color: ${preset.accent} !important;
  box-shadow: 0 0 0 1px rgba(${preset.accentRgb}, 0.85) !important;
}
`,
    swatchColors: ["#020202", preset.accent, ink],
  };
}

export const missionVioletTheme = missionControlAccentTheme({
  name: "mission-violet",
  label: "Mission Violet",
  description: "Mission Control dark cockpit with violet command accents",
  accent: "#a855f7",
  accentRgb: "168, 85, 247",
  ready: "#22d3ee",
  readyRgb: "34, 211, 238",
  alert: "#fb7185",
  alertRgb: "251, 113, 133",
});

export const missionCrimsonTheme = missionControlAccentTheme({
  name: "mission-crimson",
  label: "Mission Crimson",
  description: "Mission Control dark cockpit with hot red command accents",
  accent: "#ff1744",
  accentRgb: "255, 23, 68",
  ready: "#fbbf24",
  readyRgb: "251, 191, 36",
  alert: "#ff6b00",
  alertRgb: "255, 107, 0",
  ink: "#fff1f2",
  inkRgb: "255, 241, 242",
});

export const missionCyanTheme = missionControlAccentTheme({
  name: "mission-cyan",
  label: "Mission Cyan",
  description: "Mission Control dark cockpit with electric cyan command accents",
  accent: "#06b6d4",
  accentRgb: "6, 182, 212",
  ready: "#f97316",
  readyRgb: "249, 115, 22",
  alert: "#ef4444",
  alertRgb: "239, 68, 68",
  ink: "#ecfeff",
  inkRgb: "236, 254, 255",
});

export const missionEmeraldTheme = missionControlAccentTheme({
  name: "mission-emerald",
  label: "Mission Emerald",
  description: "Mission Control dark cockpit with green signal accents",
  accent: "#10b981",
  accentRgb: "16, 185, 129",
  ready: "#38bdf8",
  readyRgb: "56, 189, 248",
  alert: "#fb7185",
  alertRgb: "251, 113, 133",
  ink: "#ecfdf5",
  inkRgb: "236, 253, 245",
});

export const missionIonTheme = missionControlAccentTheme({
  name: "mission-ion",
  label: "Mission Ion",
  description: "Mission Control dark cockpit with deep-space ion blue thrust",
  accent: "#4c8dff",
  accentRgb: "76, 141, 255",
  ready: "#34d399",
  readyRgb: "52, 211, 153",
  alert: "#fb7185",
  alertRgb: "251, 113, 133",
  ink: "#eaf2ff",
  inkRgb: "234, 242, 255",
});

export const missionAuroraTheme = missionControlAccentTheme({
  name: "mission-aurora",
  label: "Mission Aurora",
  description: "Mission Control dark cockpit with teal-violet northern lights",
  accent: "#2dd4bf",
  accentRgb: "45, 212, 191",
  ready: "#a78bfa",
  readyRgb: "167, 139, 250",
  alert: "#fb7185",
  alertRgb: "251, 113, 133",
  ink: "#f0fdfa",
  inkRgb: "240, 253, 250",
});

export const missionSolarTheme = missionControlAccentTheme({
  name: "mission-solar",
  label: "Mission Solar",
  description: "Mission Control dark cockpit with warm gold flight-deck lights",
  accent: "#fbbf24",
  accentRgb: "251, 191, 36",
  ready: "#4ade80",
  readyRgb: "74, 222, 128",
  alert: "#f87171",
  alertRgb: "248, 113, 113",
  ink: "#fffbeb",
  inkRgb: "255, 251, 235",
});

export const missionNovaTheme = missionControlAccentTheme({
  name: "mission-nova",
  label: "Mission Nova",
  description: "Mission Control dark cockpit with magenta starburst command",
  accent: "#ec4899",
  accentRgb: "236, 72, 153",
  ready: "#22d3ee",
  readyRgb: "34, 211, 238",
  alert: "#fb923c",
  alertRgb: "251, 146, 60",
  ink: "#fdf2f8",
  inkRgb: "253, 242, 248",
});

export const missionFrostTheme = missionControlAccentTheme({
  name: "mission-frost",
  label: "Mission Frost",
  description: "Mission Control dark cockpit with low-glare glacier ice accents",
  accent: "#7dd3fc",
  accentRgb: "125, 211, 252",
  ready: "#86efac",
  readyRgb: "134, 239, 172",
  alert: "#fda4af",
  alertRgb: "253, 164, 175",
  ink: "#f8fafc",
  inkRgb: "248, 250, 252",
});

/**
 * Same look as ``defaultTheme`` but with a larger root font size, looser
 * line-height, and ``spacious`` density so every rem-based size in the
 * dashboard scales up. For users who find the default 15px UI too dense.
 */
export const defaultLargeTheme: DashboardTheme = {
  name: "default-large",
  label: "Hermes Teal (Large)",
  description: "Hermes Teal with bigger fonts and roomier spacing",
  palette: defaultTheme.palette,
  typography: {
    ...DEFAULT_TYPOGRAPHY,
    baseSize: "18px",
    lineHeight: "1.65",
  },
  layout: {
    ...DEFAULT_LAYOUT,
    density: "spacious",
  },
};

export const BUILTIN_THEMES: Record<string, DashboardTheme> = {
  default: defaultTheme,
  "default-large": defaultLargeTheme,
  "nous-blue": nousBlueTheme,
  "mission-control": missionControlTheme,
  "mission-violet": missionVioletTheme,
  "mission-crimson": missionCrimsonTheme,
  "mission-cyan": missionCyanTheme,
  "mission-emerald": missionEmeraldTheme,
  "mission-ion": missionIonTheme,
  "mission-aurora": missionAuroraTheme,
  "mission-solar": missionSolarTheme,
  "mission-nova": missionNovaTheme,
  "mission-frost": missionFrostTheme,
  midnight: midnightTheme,
  ember: emberTheme,
  mono: monoTheme,
  cyberpunk: cyberpunkTheme,
  rose: roseTheme,
};
