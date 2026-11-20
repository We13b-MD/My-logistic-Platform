import { Icon } from "@iconify/react";
import { useTheme } from "@/context/ThemeContext";

interface ThemeToggleProps {
  className?: string;
  variant?: "compact" | "pill";
}

export function ThemeToggle({ className = "", variant = "compact" }: ThemeToggleProps) {
  const { actualTheme, toggleTheme } = useTheme();
  const isDark = actualTheme === "dark";

  if (variant === "pill") {
    return (
      <button
        onClick={toggleTheme}
        type="button"
        aria-label="Toggle color theme"
        title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all duration-200 border ${
          isDark
            ? "bg-slate-800/90 hover:bg-slate-700/90 text-amber-300 border-slate-700 shadow-sm"
            : "bg-slate-100 hover:bg-slate-200 text-sky-700 border-slate-300 shadow-sm"
        } ${className}`}
      >
        <div className="relative w-4 h-4 flex items-center justify-center">
          <Icon
            icon={isDark ? "solar:moon-bold-duotone" : "solar:sun-2-bold-duotone"}
            className={`w-4 h-4 transition-transform duration-300 ${isDark ? "text-amber-300 rotate-0" : "text-amber-500 rotate-90"}`}
          />
        </div>
        <span className={isDark ? "text-slate-200" : "text-slate-700"}>
          {isDark ? "Dark" : "Light"}
        </span>
      </button>
    );
  }

  // Default compact icon button
  return (
    <button
      onClick={toggleTheme}
      type="button"
      aria-label="Toggle color theme"
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      className={`relative w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-200 border focus:outline-none focus:ring-2 focus:ring-teal-500/50 ${
        isDark
          ? "bg-slate-800/80 hover:bg-slate-700 text-amber-300 border-slate-700/80 hover:border-slate-600 shadow-inner"
          : "bg-white hover:bg-slate-50 text-amber-500 border-slate-200 hover:border-slate-300 shadow-sm"
      } ${className}`}
    >
      <Icon
        icon={isDark ? "solar:moon-bold-duotone" : "solar:sun-2-bold-duotone"}
        className={`w-4.5 h-4.5 transition-all duration-300 ${
          isDark ? "rotate-0 scale-100" : "rotate-90 scale-105"
        }`}
      />
    </button>
  );
}
