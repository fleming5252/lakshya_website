# Anchor & Vale — Construction Reveal Section

A premium, single-section website block built around a portrait image-sequence
animation: a luxury home rising from a bare concrete foundation to a finished
residence. Built with plain HTML, CSS, and vanilla JavaScript — no video
element, no external libraries, no CDN.

```
/
├── index.html
├── style.css
├── script.js
├── README.md
└── frames/
    ├── frame_0001.jpg
    ├── frame_0002.jpg
    ├── ...
    └── frame_0302.jpg
```

Drop your 302 JPGs into `frames/` using the naming pattern above and open
`index.html` in a browser — no build step, no server required (though serving
over `http://` rather than `file://` is recommended; see Browser
Compatibility below).

---

## How frame loading works

The sequence is never loaded as 302 simultaneous requests. `script.js`
loads it in three phases:

1. **Digit-pattern probe.** The very first request is `frame_0001.jpg`. If
   that 404s, the script retries with `frame_001.jpg` then `frame_01.jpg`, so
   the sequence still works if your export tool used fewer padding digits.
2. **Initial buffer.** The first 24 frames (`initialBufferFrames` in the
   config) are fetched with limited concurrency (6 at a time). Once they're
   all decoded, the loader is hidden, frame 1 is painted, and playback is
   allowed to begin. This keeps first paint fast regardless of total frame
   count.
3. **Background streaming.** The remaining ~278 frames load afterward using
   `requestIdleCallback` (falling back to `setTimeout` where unsupported), in
   small batches of 6. Each batch is prioritized **ahead of the current
   playhead first**, then backfills any earlier gaps — so the frames the
   viewer is about to see always arrive before frames they've already passed.

Every loaded `Image` object is cached in a flat array keyed by frame index
and is never re-requested. Frames that fail to load are marked (not
endlessly retried) so a single missing file can't stall the whole sequence.

## How the animation works

- A single `<canvas>` is the paint target. On each `requestAnimationFrame`
  tick, elapsed playback time is converted to a target frame index using a
  fixed total duration (`durationMs`, default 8000ms for all 302 frames),
  **not** a fixed frame-per-tick counter — so playback speed stays consistent
  across 60Hz, 120Hz, and throttled displays.
- **No flicker, no blank frames:** the loop only ever advances the canvas to
  a frame that is already fully decoded (`highestContiguousLoaded`). If
  playback time outruns what's been loaded, it holds the last good frame
  until loading catches up, rather than showing a gap or a white flash.
- Each frame is drawn with a manual "cover" crop (matching CSS
  `object-fit: cover`) so any source aspect ratio fills the portrait frame
  without distortion, and the canvas backing store is sized to the element's
  actual CSS pixels × device pixel ratio (capped at 2x) for crisp, non-blurry
  frames without over-allocating memory.
- The animation plays **once**, start to finish, and holds on the completed
  house — it does not loop — so the finished home "belongs" to the page
  rather than resetting.
- A thin progress rail beneath the animation and a warm lighting shift
  (`.stage--warm`, triggered at 62% progress) track playback progress, tying
  the ambient light behind the animation to how far construction has
  advanced.

### Play / pause behavior

- **Autoplay** begins as soon as the initial buffer is ready *and* the
  section is at least 20% in the viewport (`IntersectionObserver`,
  `threshold: 0.2`).
- **Pauses** when the section scrolls out of view, or the browser tab is
  backgrounded (`visibilitychange`), and **resumes exactly where it left
  off** — the elapsed-time accumulator isn't reset, only the rAF loop is
  stopped and restarted.
- **`prefers-reduced-motion: reduce`** skips playback entirely: only the
  final frame (completed house) is loaded and shown, with no animated
  transition, per the accessibility requirements below.

## How to replace frames

1. Export your sequence as JPGs named `frame_0001.jpg` … `frame_NNNN.jpg`
   (four-digit, zero-padded) into the `frames/` folder.
2. In `script.js`, update the `CONFIG` block at the top:
   ```js
   var CONFIG = {
     totalFrames: 302,   // set this to your actual frame count
     durationMs: 8000,   // total play-through time in milliseconds
     ...
   };
   ```
3. Keep frames in a consistent portrait aspect ratio (the layout assumes
   roughly 4:5) for the best edge-blend and pedestal composition. Other
   ratios still work — the canvas crops to cover automatically — but very
   wide or very tall sources will lose more of the image to cropping.
4. Frame 1 should be the bare foundation; the final frame should be the
   fully completed home, since the surrounding lighting and progress rail
   are tuned to that arc.

## Performance optimizations

- Tiered loading (buffer → idle-time streaming) instead of loading all
  frames up front.
- Nearest-frame-first prioritization during background streaming.
- `decoding="async"` on every frame image to avoid blocking the main thread
  on decode.
- Canvas backing resolution is capped at 2x device pixel ratio — sharp on
  Retina/HiDPI without wasting memory at higher densities.
- Resize handling is debounced (120ms) and only reallocates the canvas
  backing store when the on-screen size actually changed.
- Playback and loading both fully pause when the section is off-screen or
  the tab is hidden, so a section a visitor never scrolls to costs nothing
  after its initial buffer.
- `will-change`-free, GPU-cheap CSS: edge blending uses `mask-image` /
  gradient overlays rather than filters or box-shadows on the animated
  element itself, keeping the compositor path simple.

## Customization guide

| Want to change...              | Edit                                                              |
|---------------------------------|--------------------------------------------------------------------|
| Total frame count               | `CONFIG.totalFrames` in `script.js`                                |
| Playback speed / duration       | `CONFIG.durationMs` in `script.js`                                  |
| Initial buffer size             | `CONFIG.initialBufferFrames` in `script.js`                         |
| When lighting turns warm        | `CONFIG.warmFromProgress` (0–1) in `script.js`                      |
| Color palette                   | CSS custom properties in the `:root` block of `style.css`           |
| Heading / body copy              | Text content inside `.content` in `index.html`                     |
| Animation stage size (desktop)   | `.build-inner` grid-template-columns (`45% 55%`) in `style.css`     |
| Edge feathering strength         | `mask-image` radial-gradient stops on `.frame-wrap` in `style.css`  |

## Browser compatibility

Built on widely supported, standard web platform features:

- **Canvas 2D** — all modern browsers.
- **`IntersectionObserver`** — all modern browsers; falls back to "always
  visible" if unavailable, so playback still runs.
- **`requestIdleCallback`** — Chrome, Edge, Firefox; falls back to a
  `setTimeout`-based scheduler on Safari/older browsers, so background
  streaming still works everywhere.
- **CSS `mask-image` / `-webkit-mask-image`** — both prefixes are included
  for the edge-feathering effect; on very old browsers without mask support,
  the animation simply renders as a soft-cornered rectangle instead of a
  feathered edge (graceful degradation, no layout breakage).
- Tested against current Chrome, Safari, Firefox, and Edge. For local
  testing, serving via a simple local HTTP server (e.g. `python3 -m http.server`)
  is recommended over opening `index.html` directly with `file://`, since
  some browsers restrict `fetch`/image loading semantics differently under
  `file://`.

## Accessibility

- The canvas has `role="img"` with a descriptive `aria-label` summarizing
  the animation for screen reader users.
- All interactive elements (`Explore Projects`, `Get Free Consultation`) are
  real `<button>` elements, reachable and activatable by keyboard, with a
  visible `:focus-visible` outline.
- `prefers-reduced-motion: reduce` disables scroll-in transitions, ambient
  motion, and frame-by-frame playback, showing the completed home
  immediately instead.
- Color contrast in the palette (`#2C2C2C` text on `#FAF8F5` background,
  etc.) meets WCAG AA for body text.
