# Help Overlay — Page Preview Style

A reusable, full-screen help overlay that dims the actual page and places numbered marker badges directly over real UI components. Clicking a marker shows a tooltip with a description. No framework dependencies — vanilla ES modules.

---

## What It Looks Like

When the user clicks "How to Use":

1. The page dims with a semi-transparent backdrop (the actual page is still visible underneath)
2. Each annotated UI component gets a **colored highlight outline** drawn around it
3. **Numbered marker badges** (pulsing circles) appear at the corner of each component
4. A **title bar** at the top shows the overlay title and instruction hint
5. An optional **workflow bar** at the bottom shows a step sequence (e.g. Start → Run → Stop)
6. Clicking any marker opens a **tooltip** with the component's name and description
7. Close via the X button, clicking the backdrop, or pressing Escape

---

## File Structure

```
shared/
  css/help-overlay.css   — All overlay styles (markers, highlights, tooltips, bars)
  js/help-overlay.js     — Single exported function: initHelpOverlay()
```

Copy these two files into your project. Reference them from your HTML.

---

## Integration Steps

### 1. Link the CSS

In your page's `<head>`, add:

```html
<link rel="stylesheet" href="path/to/help-overlay.css">
```

### 2. Call `initHelpOverlay()` from a module script

At the bottom of your `<body>`, after your app scripts:

```html
<script type="module">
  import { initHelpOverlay } from 'path/to/help-overlay.js';

  initHelpOverlay([
    // Items go here (see below)
  ], {
    title: 'How to Use — My App'
  });
</script>
```

This automatically:
- Creates a "How to Use" button and appends it to the element matching `.controls` (falls back to `document.body`)
- Builds the full overlay on demand when the button is clicked

---

## API

### `initHelpOverlay(items, options)`

**`items`** — Array of item objects. Two types:

#### Component Item (annotates a real DOM element)

```js
{
  selector: '.status-bar',       // Required — CSS selector for the target element
  label: 'Status Bar',           // Required — tooltip heading
  desc: 'Shows current state.',  // Required — tooltip body text (supports HTML)
  anchor: 'top-right',           // Optional — where the marker badge sits (default: 'top-left')
  variant: 'tip'                 // Optional — color theme: 'tip' (green) or 'warn' (amber)
}
```

#### Flow Item (workflow bar at the bottom)

```js
{
  type: 'flow',
  steps: [
    { label: 'Start Camera', color: 'blue' },
    { label: 'Start Detection', color: 'green' },
    { label: 'Stop Camera', color: 'red' }
  ]
}
```

Only one flow item is used. It renders a fixed bar at the bottom: `Step 1 → Step 2 → Step 3`.

**`options`** — Object:

| Key     | Type   | Description                         |
|---------|--------|-------------------------------------|
| `title` | string | Title shown in the overlay header bar. Default: `'How to Use'` |

### Anchor positions

Controls where the numbered marker badge is placed relative to the target element:

| Value        | Position                           |
|--------------|------------------------------------|
| `top-left`   | Top-left corner (default)          |
| `top-right`  | Top-right corner                   |
| `center`     | Center of the element              |
| `left`       | Left edge, vertically centered     |

### Variants

| Value   | Marker color | Highlight color | Use for                    |
|---------|-------------|-----------------|----------------------------|
| _(none)_ | Blue (#3b82f6) | Blue         | Standard UI components     |
| `tip`   | Green (#22c55e) | Green        | Helpful features, tips     |
| `warn`  | Amber (#ca8a04) | Amber        | Requirements, warnings     |

---

## Full Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My App</title>
  <link rel="stylesheet" href="css/style.css">
  <link rel="stylesheet" href="shared/css/help-overlay.css">
</head>
<body>
  <div class="container">
    <h1>My App</h1>

    <div class="status-bar">
      <span id="status">Ready</span>
      <span id="fps" hidden>0 FPS</span>
    </div>

    <div class="video-container">
      <video id="camera" autoplay playsinline></video>
      <canvas id="overlay"></canvas>
    </div>

    <div class="controls">
      <button id="startBtn">Start</button>
      <button id="stopBtn" disabled>Stop</button>
    </div>

    <div id="results" class="results" hidden></div>
  </div>

  <script type="module" src="js/app.js"></script>
  <script type="module">
    import { initHelpOverlay } from './shared/js/help-overlay.js';
    initHelpOverlay([
      {
        selector: '.status-bar',
        label: 'Status Bar',
        desc: 'Displays the current app state and FPS counter during processing.',
        anchor: 'top-right'
      },
      {
        selector: '.video-container',
        label: 'Camera View',
        desc: 'Live camera feed with a canvas overlay for drawing detection results.',
        anchor: 'top-left'
      },
      {
        selector: '#startBtn',
        label: 'Start',
        desc: 'Opens the camera and begins processing.',
        anchor: 'top-left'
      },
      {
        selector: '#stopBtn',
        label: 'Stop',
        desc: 'Stops the camera and processing loop.',
        anchor: 'top-left'
      },
      {
        selector: '#results',
        label: 'Results Panel',
        desc: 'Appears during processing. Shows detection output and confidence scores.',
        anchor: 'top-right',
        variant: 'tip'
      },
      {
        type: 'flow',
        steps: [
          { label: 'Start', color: 'blue' },
          { label: 'Processing...', color: 'green' },
          { label: 'Stop', color: 'red' }
        ]
      }
    ], {
      title: 'How to Use — My App'
    });
  </script>
</body>
</html>
```

---

## Key Behaviors

- **Hidden elements are temporarily revealed**: If a target element has `hidden` attribute (e.g. a progress bar that only shows during loading), the overlay temporarily shows it so the marker and highlight can be positioned. It's re-hidden when the overlay closes.
- **Responsive repositioning**: Markers, highlights, and tooltips reposition on window resize and scroll.
- **Smart tooltip placement**: Tooltips automatically position below, to the right, to the left, or above the marker depending on available screen space, with a directional arrow pointing to the marker.
- **Trigger button placement**: The "How to Use" button is inserted into the first `.controls` element found on the page. If none exists, it appends to `<body>`. To change this, modify the selector in `help-overlay.js` around line 10.
- **Keyboard support**: Press Escape to close the overlay.

---

## Customization

### Changing the trigger button selector

In `help-overlay.js`, change the selector on this line:

```js
const controls = document.querySelector('.controls');
```

To any CSS selector matching your button container, e.g. `.toolbar`, `#header-actions`, `nav`.

### Changing the trigger button text

In `help-overlay.js`, change:

```js
btn.textContent = 'How to Use';
```

### Theming

The overlay uses a dark theme by default. Key colors are defined directly in `help-overlay.css`:

| Token                          | Default            | Purpose                     |
|-------------------------------|--------------------|-----------------------------|
| Backdrop background           | `rgba(0,0,0,0.6)` | Dim level over the page     |
| Header/flow bar background    | `rgba(22,33,62,…)` | Top and bottom bars         |
| Tooltip background            | `#16213e`          | Tooltip card fill           |
| Tooltip border                | `#2a3a5c`          | Tooltip/highlight borders   |
| Blue marker                   | `#3b82f6`          | Default marker color        |
| Green marker                  | `#22c55e`          | `variant: 'tip'`            |
| Amber marker                  | `#ca8a04`          | `variant: 'warn'`           |

For a light theme, override these values. The component structure uses BEM-style class names (`.help-overlay__header`, `.help-marker--green`, etc.) so overrides are straightforward.

### Adding more marker variants

1. Add CSS classes in `help-overlay.css`:
   ```css
   .help-marker--purple { background: #8b5cf6; box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.35), 0 2px 8px rgba(0, 0, 0, 0.5); }
   .help-highlight--purple { border-color: #8b5cf6; box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.12); }
   ```
2. In `help-overlay.js`, the variant name is applied via `classList.add('help-marker--' + variant)`, so just use `variant: 'purple'` in your item config.

### Adding more anchor positions

In `help-overlay.js`, add a new case to the `switch (anchor)` block in `positionMarker()`:

```js
case 'bottom-right':
  x = r.right + sx - 22;
  y = r.bottom + sy - 22;
  break;
```

---

## Flow step colors

| Color value | CSS class                    | Rendered color |
|------------|------------------------------|----------------|
| `blue`     | `.help-flow-bar__step--blue` | #60a5fa        |
| `green`    | `.help-flow-bar__step--green`| #4ade80        |
| `red`      | `.help-flow-bar__step--red`  | #f87171        |
| _(none)_   | _(base class)_               | #e0e0e0        |

Add more by defining `.help-flow-bar__step--{color}` in the CSS.
