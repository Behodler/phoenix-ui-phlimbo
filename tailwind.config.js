/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Phoenix Core Palette
        pxusd: {
          cream: "var(--pxusd-cream)",
          white: "var(--pxusd-white)",
          teal: {
            950: "var(--pxusd-teal-950)",
            900: "var(--pxusd-teal-900)",
            800: "var(--pxusd-teal-800)",
            700: "var(--pxusd-teal-700)",
            600: "var(--pxusd-teal-600)",
            400: "var(--pxusd-teal-400)",
          },
          orange: {
            500: "var(--pxusd-orange-500)",
            400: "var(--pxusd-orange-400)",
            300: "var(--pxusd-orange-300)",
          },
          pink: {
            400: "var(--pxusd-pink-400)",
          },
          yellow: {
            400: "var(--pxusd-yellow-400)",
          },
        },
        // Semantic colors using CSS variables
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
      },
      backgroundImage: {
        "phoenix-hero": "var(--grad-hero)",
        "phoenix-accent": "var(--grad-accent)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        "phoenix-btn": "0 10px 25px rgba(255,100,0,0.35)",
        "phoenix-card": "0 20px 50px rgba(0,0,0,0.2)",
      },
    },
  },
  plugins: [],
}