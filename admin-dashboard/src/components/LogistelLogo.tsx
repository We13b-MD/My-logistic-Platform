import React from "react";
import logoImg from "@/assets/logistelfinalLogo.png";

export interface LogistelLogoProps {
  /**
   * 'horizontal': Standard layout
   * 'stacked': Stacked vertically
   * 'mark': Image mark only
   */
  layout?: "horizontal" | "stacked" | "mark";
  /**
   * Size presets:
   * 'sm': height ~32px
   * 'md': height ~44px
   * 'lg': height ~56px
   * 'xl': height ~72px
   */
  size?: "sm" | "md" | "lg" | "xl";
  /** Custom title override */
  title?: string;
  /** Optional subtitle tag displayed alongside the brand logo */
  subtext?: string;
  /** Custom wrapper class */
  className?: string;
  /** Optional title text class override */
  titleClassName?: string;
  /** Custom click handler */
  onClick?: () => void;
}

export const LogistelLogo: React.FC<LogistelLogoProps> = ({
  layout = "horizontal",
  size = "md",
  subtext,
  className = "",
  onClick,
}) => {
  // Size presets map
  const sizeMap = {
    sm: { imgHeight: "h-8", subText: "text-[9px]" },
    md: { imgHeight: "h-11", subText: "text-[10px]" },
    lg: { imgHeight: "h-14", subText: "text-xs" },
    xl: { imgHeight: "h-20", subText: "text-xs" },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  const logoImage = (
    <img
      src={logoImg}
      alt="Logistel Brand Logo"
      className={`${currentSize.imgHeight} w-auto object-contain shrink-0 filter drop-shadow-[0_2px_10px_rgba(41,161,149,0.3)]`}
    />
  );

  if (layout === "mark" || !subtext) {
    return (
      <div
        className={`inline-flex items-center ${onClick ? "cursor-pointer active:scale-95 transition-transform" : ""} ${className}`}
        onClick={onClick}
      >
        {logoImage}
      </div>
    );
  }

  if (layout === "stacked") {
    return (
      <div
        className={`flex flex-col items-center text-center ${onClick ? "cursor-pointer active:scale-95 transition-transform" : ""} ${className}`}
        onClick={onClick}
      >
        {logoImage}
        {subtext && (
          <p className={`text-slate-400 mt-1.5 font-mono uppercase tracking-widest font-semibold ${currentSize.subText}`}>
            {subtext}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 ${onClick ? "cursor-pointer active:scale-95 transition-transform" : ""} ${className}`}
      onClick={onClick}
    >
      {logoImage}
      {subtext && (
        <div className="flex flex-col justify-center border-l border-slate-700/80 pl-3">
          <span className={`text-slate-300 font-mono uppercase tracking-widest font-semibold ${currentSize.subText}`}>
            {subtext}
          </span>
        </div>
      )}
    </div>
  );
};
