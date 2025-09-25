# Phoenix Theme System Documentation

## Overview

The Phoenix UI now uses a comprehensive theme system based on the Phoenix pxUSD palette, featuring dark/light mode support and consistent color management across all components.

## Palette Colors

### Core Phoenix Palette
- **Cream**: `#FDF7F2` - Light background color
- **Teal Spectrum**:
  - 950: `#03080C` (Darkest)
  - 900: `#050E16`
  - 800: `#0A1C28`
  - 700: `#102736`
  - 600: `#163343`
  - 400: `#1f5a73`
- **Orange Spectrum**:
  - 500: `#FF6A00` (Primary brand color)
  - 400: `#FF8C42`
  - 300: `#FFB566`
- **Accent Colors**:
  - Pink: `#FF4D6D`
  - Yellow: `#FFD93D`
- **White**: `#FFFFFF`

### Gradients
- **Hero Gradient**: Linear gradient from teal-950 → teal-900 → teal-800
- **Accent Gradient**: Linear gradient from pink-400 → orange-400 → yellow-400

## CSS Variable System

### Semantic Color Variables
The theme uses semantic CSS variables that adapt to light/dark modes:

```css
:root {
  --background: /* Adapts to light/dark */
  --foreground: /* Main text color */
  --card: /* Card background */
  --card-foreground: /* Card text color */
  --primary: /* Primary brand color (orange) */
  --primary-foreground: /* Text on primary background */
  --secondary: /* Secondary actions (teal) */
  --secondary-foreground: /* Text on secondary background */
  --muted: /* Muted background */
  --muted-foreground: /* Muted text */
  --accent: /* Accent color (pink) */
  --accent-foreground: /* Text on accent background */
  --border: /* Border color */
  --input: /* Input field borders */
  --ring: /* Focus ring color */
}
```

### Theme Modes

#### Dark Mode (Default)
- Background: `#03080C` (teal-950)
- Text: `#F3F7FA` (light gray)
- Cards: `#0A1C28` (teal-800)
- Borders: `rgba(255,255,255,0.12)`

#### Light Mode
- Background: `#FDF7F2` (cream)
- Text: `#050E16` (teal-900)
- Cards: `#E9EEF1` (light gray)
- Borders: `rgba(0,0,0,0.08)`

## Tailwind Integration

### Custom Colors
The theme extends Tailwind with Phoenix-specific colors:

```javascript
pxusd: {
  cream: "var(--pxusd-cream)",
  white: "var(--pxusd-white)",
  teal: { 950, 900, 800, 700, 600, 400 },
  orange: { 500, 400, 300 },
  pink: { 400 },
  yellow: { 400 }
}
```

### Background Images
- `bg-phoenix-hero`: Hero gradient background
- `bg-phoenix-accent`: Accent gradient background

### Box Shadows
- `shadow-phoenix-btn`: Button shadow with orange glow
- `shadow-phoenix-card`: Card drop shadow

## Component Classes

### Buttons

#### Primary Button
```css
.phoenix-btn-primary {
  background: var(--grad-accent); /* Gradient */
  color: var(--pxusd-white);
  border-radius: 14px;
  padding: 0.75rem 1.4rem;
  font-weight: 700;
  box-shadow: 0 10px 25px rgba(255,100,0,0.35);
  /* Includes hover/active/disabled states */
}
```

#### Ghost Button
```css
.phoenix-btn-ghost {
  background: transparent;
  color: var(--foreground);
  border: 2px solid var(--border);
  border-radius: 14px;
  padding: 0.75rem 1.4rem;
  /* Includes hover states for both themes */
}
```

### Cards
```css
.phoenix-card {
  background: var(--card);
  color: var(--card-foreground);
  border: 1px solid var(--border);
  border-radius: 20px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.2);
}
```

### Navigation
```css
.phoenix-nav {
  backdrop-filter: blur(12px) saturate(180%);
  background: linear-gradient(180deg, rgba(3,8,12,0.95), rgba(10,28,40,0.85));
  border-bottom: 1px solid var(--border);
}
```

## Theme Switching

The theme system supports dynamic switching via data attributes:

```javascript
// Set dark theme
document.documentElement.setAttribute('data-theme', 'dark');
document.documentElement.classList.add('dark');

// Set light theme
document.documentElement.setAttribute('data-theme', 'light');
document.documentElement.classList.remove('dark');
```

The Header component includes a theme toggle button that manages this state.

## Usage Guidelines

### Using Semantic Colors
Always prefer semantic color variables over direct palette colors:

✅ **Good:**
```css
color: var(--foreground);
background: var(--card);
border-color: var(--border);
```

❌ **Avoid:**
```css
color: #F3F7FA;
background: #0A1C28;
border-color: rgba(255,255,255,0.12);
```

### Tailwind Classes
Use the semantic Tailwind classes:

✅ **Good:**
```html
<div className="bg-card text-card-foreground border border-border">
```

❌ **Avoid:**
```html
<div className="bg-neutral-800 text-white border-neutral-700">
```

### Phoenix-Specific Classes
For components requiring the Phoenix brand aesthetic, use the custom classes:

```html
<button className="phoenix-btn-primary">Primary Action</button>
<button className="phoenix-btn-ghost">Secondary Action</button>
<div className="phoenix-card">Card Content</div>
<header className="phoenix-nav">Navigation</header>
```

## File Organization

### Theme Files
- `src/index.css`: Main theme definitions and CSS variables
- `tailwind.config.js`: Tailwind configuration with Phoenix colors
- `PHOENIX_THEME_SYSTEM.md`: This documentation

### Component Files
All components have been updated to use the new theme system:
- `src/components/layout/Header.tsx`: Includes theme toggle
- `src/components/ui/*.tsx`: All UI components use semantic colors
- `src/components/vault/*.tsx`: Vault-specific components themed
- `src/pages/VaultPage.tsx`: Main page with theme setup

## Migration Notes

The theme migration from the previous Tokemak-inspired theme involved:

1. **Replaced neutral colors** with Phoenix teal spectrum
2. **Replaced lime-400** with orange gradient primary buttons
3. **Added comprehensive CSS variables** for theme consistency
4. **Implemented light/dark mode** support
5. **Created Phoenix-specific component classes** for consistent styling
6. **Updated all components** to use semantic color variables
7. **Removed hardcoded colors** in favor of theme variables

## Future Enhancements

Potential future improvements to the theme system:

- **System Theme Detection**: Automatically detect user's OS theme preference
- **Theme Persistence**: Save user's theme choice in localStorage
- **Animation Transitions**: Smooth theme switching animations
- **Theme Variants**: Additional theme variants (e.g., high contrast)
- **Component Theme Overrides**: Allow per-component theme customization

## Browser Support

The theme system uses modern CSS features:
- CSS Custom Properties (CSS Variables)
- CSS Gradients
- Backdrop Filter (for navigation blur effect)
- CSS Grid and Flexbox

Supports all modern browsers (Chrome, Firefox, Safari, Edge).