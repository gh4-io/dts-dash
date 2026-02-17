# UI_BACKGROUND.md — Background Image Configuration

> Documentation for enabling, disabling, and customizing the dashboard background image

## Overview

The dashboard supports an optional fixed background image that displays behind all content across all pages (login, dashboard, flight board, capacity, etc.). The background uses a fixed positioning strategy to maintain consistent placement across page transitions and scrolling.

## Current Status

**Status:** Disabled by default
**Image Location:** `/public/bg-abstract.jpg`
**Configuration File:** `src/app/globals.css`

## How to Enable

1. Open `src/app/globals.css`
2. Locate the `@layer base` section (near the bottom of the file)
3. Uncomment the background image properties in the `body` selector:

```css
body {
  @apply bg-background text-foreground;
  font-feature-settings:
    "rlig" 1,
    "calt" 1;
  background-image: url("/bg-abstract.jpg");
  background-attachment: fixed;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}
```

4. Uncomment the overlay pseudo-element:

```css
body::before {
  content: "";
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: hsl(var(--background) / 0.85);
  pointer-events: none;
  z-index: -1;
}
```

## How to Disable

Comment out both the background properties in `body` and the `body::before` pseudo-element (current default state).

## Customization Options

### Change the Image

1. Place your image in `/public/` directory (e.g., `/public/my-bg.jpg`)
2. Update the `background-image` URL:
   ```css
   background-image: url("/my-bg.jpg");
   ```

**Supported formats:**
- **JPEG/JPG** - Standard photos (no transparency)
- **PNG** - Supports alpha/transparency (larger file size)
- **WebP** - Supports alpha, best compression (recommended)
- **AVIF** - Supports alpha, excellent compression (newer format)

### Adjust Subtlety/Visibility

The overlay opacity controls how subtle the background appears. Lower values make the image more visible.

**Current value:** `0.85` (85% opacity overlay = very subtle)

```css
background: hsl(var(--background) / 0.85);
                              /* ↑ Adjust this value */
```

**Opacity scale:**
- `0.95` - Extremely subtle (barely visible)
- `0.85` - Very subtle (current default)
- `0.75` - Moderately subtle
- `0.65` - Noticeable
- `0.50` - Half opacity (strong visibility)
- `0.00` - No overlay (full image visibility)

### Change Background Positioning

Modify the background properties as needed:

```css
/* Default - fills viewport, stays fixed */
background-attachment: fixed;
background-size: cover;
background-position: center;

/* Alternative - scrolls with page */
background-attachment: scroll;

/* Alternative - contains entire image */
background-size: contain;

/* Alternative - align to top-left */
background-position: top left;
```

### Use Transparent Images

If you want parts of the image to be transparent:

1. Use PNG or WebP format (JPG does not support transparency)
2. Edit your image in Photoshop/GIMP/Photopea to add alpha channel
3. Export as PNG or WebP
4. Replace the file in `/public/`
5. Update the URL in `globals.css`

Transparent areas will show through to the theme's background color.

## Performance Considerations

### CSS Effects (Blur, Filters)

**Warning:** Adding CSS blur or filter effects to a fixed, full-screen background can significantly impact performance:
- Stuttering during scrolling
- Laggy page transitions
- High GPU usage
- Battery drain on mobile devices

**Recommendation:** If you want a blurred effect, pre-blur the image in an image editor (Photoshop, GIMP) before adding it. This has **zero runtime performance cost**.

### CSS Blur Example (Not Recommended)

```css
/* ⚠️ Performance warning - test on target devices first */
body {
  background-image: url("/bg-abstract.jpg");
  filter: blur(3px);
}
```

### File Size Optimization

- Use WebP format for best compression with transparency support
- Optimize images before adding (use tools like Squoosh, TinyPNG)
- Consider serving different sizes for mobile vs desktop

## Technical Details

### Fixed Positioning Strategy

The `background-attachment: fixed` property ensures:
- Background stays in the same position during scrolling
- Consistent appearance across all pages (login → dashboard → flight board)
- No repositioning during page transitions

### Z-Index Layering

```
┌─────────────────────────────────────┐
│ Content (z-index: auto)             │  ← Foreground
├─────────────────────────────────────┤
│ Overlay (z-index: -1)               │  ← Semi-transparent
├─────────────────────────────────────┤
│ Background image (body background)  │  ← Bottom layer
└─────────────────────────────────────┘
```

The overlay (`body::before`) sits between the background image and content:
- `z-index: -1` keeps it behind all content
- `pointer-events: none` allows clicks to pass through
- `position: fixed` maintains consistent positioning

### Theme Integration

The overlay uses the theme's background color variable:

```css
background: hsl(var(--background) / 0.85);
```

This ensures:
- Automatic adjustment when switching themes
- Consistent with light/dark mode
- No hardcoded colors

## Examples

### Very Subtle (Recommended for Production)

```css
/* Barely visible, professional appearance */
body::before {
  background: hsl(var(--background) / 0.90);
}
```

### Moderate Visibility

```css
/* Noticeable but not distracting */
body::before {
  background: hsl(var(--background) / 0.70);
}
```

### Strong Visibility (Use with Caution)

```css
/* Very visible - may affect readability */
body::before {
  background: hsl(var(--background) / 0.40);
}
```

### No Overlay (Full Image)

```css
/* Remove or comment out body::before entirely */
/* May reduce text readability depending on image */
```

## Troubleshooting

### Image Not Showing

1. Verify the image exists at `/public/bg-abstract.jpg`
2. Check the file path in `background-image: url(...)`
3. Ensure the styles are uncommented
4. Clear browser cache (Ctrl+Shift+R / Cmd+Shift+R)

### Image Too Prominent/Distracting

Increase the overlay opacity:
```css
background: hsl(var(--background) / 0.95);
```

### Performance Issues

1. Remove any `filter: blur()` CSS properties
2. Pre-blur the image in an image editor instead
3. Optimize/compress the image file
4. Consider using a smaller resolution image
5. Test on target devices (mobile, older hardware)

### Image Shifts Between Pages

If using `background-attachment: scroll`, change to `fixed`:
```css
background-attachment: fixed;
```

## Related Files

- `src/app/globals.css` - Background configuration
- `public/bg-abstract.jpg` - Default background image
- `.claude/SPECS/REQ_Themes.md` - Theme system documentation

## Change History

- **2026-02-16** - Initial implementation with subtle overlay approach
- **2026-02-16** - Disabled by default, added full documentation
