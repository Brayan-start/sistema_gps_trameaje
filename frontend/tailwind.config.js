/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: "#0b1121",
          card: "#111827",
          sidebar: "#0f172a",
          border: "#1e293b",
          hover: "#1e293b",
        },
        accent: {
          50: "#ecfeff",
          100: "#cffafe",
          200: "#a5f3fc",
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490",
          DEFAULT: "#22d3ee",
          light: "#67e8f9",
        },
        alert: {
          DEFAULT: "#ef4444",
          light: "#fca5a5",
          dark: "#dc2626",
        },
        warning: {
          DEFAULT: "#f59e0b",
          light: "#fbbf24",
        },
        success: {
          DEFAULT: "#10b981",
          light: "#34d399",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
        display: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px -1px rgba(0, 0, 0, 0.2)",
        "card-hover": "0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3)",
        modal: "0 20px 60px -12px rgba(0, 0, 0, 0.6)",
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      animation: {
        "slide-up": "slideUp 0.3s ease-out",
        "fade-in": "fadeIn 0.3s ease-out",
        "pulse-border": "pulseBorder 2s infinite",
        "pulse-alert": "pulseAlert 1.5s infinite",
        "slide-in-left": "slideInLeft 0.3s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
      },
      keyframes: {
        slideUp: {
          from: { transform: "translateY(100%)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        pulseBorder: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(34, 211, 238, 0.4)" },
          "50%": { boxShadow: "0 0 0 12px rgba(34, 211, 238, 0)" },
        },
        pulseAlert: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(239, 68, 68, 0.5)" },
          "50%": { boxShadow: "0 0 0 16px rgba(239, 68, 68, 0)" },
        },
        slideInLeft: {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        slideInRight: {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};
