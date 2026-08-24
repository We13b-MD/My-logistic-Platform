---
name: Logistel Design System
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#bcc9c6'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#879391'
  outline-variant: '#3d4947'
  surface-tint: '#6bd8cb'
  primary: '#6bd8cb'
  on-primary: '#003732'
  primary-container: '#29a195'
  on-primary-container: '#00302b'
  inverse-primary: '#006a61'
  secondary: '#4cd7f6'
  on-secondary: '#003640'
  secondary-container: '#03b5d3'
  on-secondary-container: '#00424e'
  tertiary: '#c0c1ff'
  on-tertiary: '#1000a9'
  tertiary-container: '#8083ff'
  on-tertiary-container: '#0d0096'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#89f5e7'
  primary-fixed-dim: '#6bd8cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#005049'
  secondary-fixed: '#acedff'
  secondary-fixed-dim: '#4cd7f6'
  on-secondary-fixed: '#001f26'
  on-secondary-fixed-variant: '#004e5c'
  tertiary-fixed: '#e1e0ff'
  tertiary-fixed-dim: '#c0c1ff'
  on-tertiary-fixed: '#07006c'
  on-tertiary-fixed-variant: '#2f2ebe'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-lg:
    fontFamily: Outfit
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Outfit
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Outfit
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Outfit
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  code-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  container-max: 1440px
  gutter: 24px
  margin-mobile: 16px
---

## Brand & Style
The design system for this premium B2B logistics engine is built on a foundation of "Technical Precision" and "Operational Clarity." The brand personality is authoritative yet forward-thinking, catering to logistics directors who require high-density data visualization without cognitive overload. 

The aesthetic is a refined **Modern Dark Mode** infused with **Subtle Glassmorphism**. It utilizes translucency not as a decorative flourish, but as a functional tool to establish spatial hierarchy in complex dashboard environments. By layering semi-transparent surfaces over deep, matte backgrounds, the UI maintains a sense of depth and high-end craftsmanship. The emotional response is one of calm control—transforming chaotic global supply chain data into a streamlined, executable interface.

## Colors
The palette is anchored by **Midnight Slate (#0F172A)**, providing a low-strain, professional canvas for extended use. The primary brand color, **Deep Emerald Green (#0D9488)**, is used for primary actions and "system-go" states, while **Vibrant Cyan (#06B6D4)** serves as an analytical accent for data visualization and interactive map elements.

Secondary surfaces use a slightly lighter slate to create container hierarchy. High-visibility status indicators (Success, Warning, Error) are desaturated slightly to prevent "vibrating" against the dark background, ensuring accessibility and professional tone.

## Typography
The system employs a dual-font strategy to balance character with utility. **Outfit** is used for headlines and display elements, bringing a modern, geometric precision that feels high-tech and premium. 

**Inter** handles all functional UI, body text, and data-heavy labels. Its high legibility and neutral character are essential for reading shipping manifests, timestamps, and coordinates. We use a high-contrast scale where body text is typically `Slate-300` and headlines are `White` or `Cyan-400` to ensure clear information architecture in the dark environment.

## Layout & Spacing
This design system utilizes a **12-column fluid grid** for desktop dashboards, transitioning to a **4-column grid** for mobile devices. The spacing logic is strictly based on a **4px baseline**, ensuring mathematical harmony across all components.

For the logistics engine, we prioritize density over excessive white space. Gutters are kept at a standard `24px` to allow for distinct data separation, while internal component padding (like within glass cards) uses `16px` to maintain a compact, "cockpit-like" feel.

## Elevation & Depth
Elevation is achieved through a combination of **Tonal Layering** and **Glassmorphism**, rather than traditional shadows. 

1.  **Level 0 (Base):** Midnight Slate (#0F172A).
2.  **Level 1 (Panels):** Surface Slate (#1E293B) with a subtle 1px border (#334155).
3.  **Level 2 (Glass Cards):** Semi-transparent white overlay (Opacity: 4-8%) with a `20px` Backdrop Blur. These receive a "linear-light" 1px border at the top and left edges to simulate a subtle light source.
4.  **Level 3 (Overlays/Modals):** Darker semi-transparent fill with a more pronounced `40px` blur and a faint glow from the Primary color (#0D9488) at 10% opacity.

## Shapes
The shape language is **"Standard Rounded"**, striking a balance between industrial rigidity and modern softness. All standard cards and containers use a `0.5rem` (8px) radius. Larger display sections or "Glassmorphic Hero" elements may scale up to `rounded-xl` (24px) to create a focal point. Interactive elements like buttons and input fields follow the `8px` standard to feel consistent and sturdy.

## Components
- **Glassmorphic Cards:** Used for high-level KPIs. Background: `rgba(30, 41, 59, 0.7)`, Backdrop Filter: `blur(12px)`, Border: `1px solid rgba(255, 255, 255, 0.1)`.
- **Primary Buttons:** Solid Deep Emerald Green with white text. On hover, apply a subtle Cyan outer glow. 
- **Data Tables:** Borderless design with alternating row highlights using `Slate-800/50`. Header text is uppercase `Inter` at `12px` with `0.05em` letter spacing.
- **Status Indicators:** Small circular dots or subtle pill-shaped badges. Use "Glow" effects (2px spread shadow in the indicator's own color) to represent active/live tracking.
- **Inputs:** Dark backgrounds (`Slate-900`) with a `1px` border that transitions to Cyan on focus.
- **Interactive Map Elements:** Custom markers using the Vibrant Cyan accent with a pulsing animation for live freight tracking.