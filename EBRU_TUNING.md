# Ebru hand-control tuning

This version keeps continuous fluid motion while adding ebru hand/mouse
controls and conserving the amount of pigment during spreading.

## Interaction model

- Thumb tip + index fingertip pinch behaves like a fine ebru awl (`biz`): it
  drags the existing paint film. Holding the left mouse button and dragging
  uses the same force, radius, movement cap, smoothing and dye-free behavior.
- Thumb tip + middle fingertip pinch adds exactly one paint drop per pinch. It
  does not inject velocity into the fluid. The two gestures are mutually
  exclusive; if both are detected together, neither action runs. Right-clicking
  calls the same drop function, using the palette color without adding velocity.
- Mouse movement is sampled once per simulation frame. Release, leaving the
  canvas, losing focus or hiding the page stops dragging. The context menu is
  suppressed only on the canvas; mouse painting does not require the camera.
- A drag does not inject a new dye blob on every camera frame.
- Hand impulse is 32% of the original mouse/touch impulse: controlled, but
  strong enough to visibly deform the paint at normal camera frame rates.
- Per-frame movement is capped so tracking jumps cannot sweep the whole tray.
- The contact point is the midpoint between thumb and index fingertips.
- Pinch distance is normalized to hand size and uses separate start/release
  thresholds to avoid flicker.
- Adaptive smoothing and a small dead zone suppress camera jitter.
- The supplied transparent hand images follow the smoothed contact point.
  Thumb/index pinches switch to the pinched hand with a subtle 180 ms squeeze.
  Both images align their fingertip contact to the painting hotspot. Reduced
  motion disables the transition, and tracking loss hides and resets the hand.
- Dye-density dissipation is disabled (`DENSITY_DISSIPATION = 0.0`), so colors
  are not deliberately faded as simulation time passes.
- Dye dissipation is also hard-locked to `0.0` in the advection pass and its UI
  control is removed. A GPU reduction measures premultiplied RGB and pigment
  amount (the alpha channel); after
  advection, concentrations are corrected to the saved amount. Only depositing
  paint, clearing, or resizing the simulation resets that amount. This prevents
  sampling from multiplying paint while leaving the velocity solver unchanged.
- Coverage follows pigment concentration without boosting faint traces. A
  stretched drop forms a thinner film; it does not acquire more pigment.
- The simulation starts on a neutral light-gray background
  (`BACK_COLOR = 206, 206, 206`).
  Generated pigment intensity is raised from `0.15` to `0.35` so colors remain
  clearly visible against white.
- The control panel includes an English `Clear Paint` button. It clears dye and
  residual fluid motion without stopping hand tracking or changing settings.
- Display colors divide premultiplied sRGB by pigment amount and use bounded
  coverage. This preserves the selected light/dark shade, including black and
  white; there is no peak-channel normalization or 72% brightness cap. Shading
  affects coverage rather than tinting white pigment gray. The initial
  random-splat multiplier is reduced from `10.0` to `3.0` to avoid excessive
  dye concentration at startup.
- A separate `PAINT COLOR` palette is fixed to the bottom-left corner. Its 11
  traditional swatches and native custom color input control new paint drops.
  Startup colors are also drawn from this palette instead of a random HSV hue.
- Bloom and sunray rendering paths are disabled; the interface and cursor use
  solid state changes rather than neon or glow effects.
- The camera button is a toggle. Clicking it while tracking is active stops the
  MediaPipe frame loop, camera stream, and all media tracks; clicking again
  starts a fresh camera session.
- The top-left EN / TR selector translates the guide, controls, palette,
  camera states, and errors without resetting the drawing or camera. It saves
  the language preference locally; English is the default on a first visit.

## Why

Traditional ebru places pigment on a thickened liquid surface and then shapes
that floating color with tools. The shaping gesture should produce a narrow,
controlled deformation of colors already on the surface, not a broad turbulent
push or continuous addition of paint.

References:

- UNESCO, *Ebru, Turkish art of marbling*:
  https://ich.unesco.org/en/RL/ebru-turkish-art-of-marbling-00644
- Republic of Turkiye Ministry of Culture and Tourism, *Ebru Sanati*:
  https://www.kulturportali.gov.tr/portal/ebrusanati

## Main tuning values

The hand preset is near the start of `initHandTracking()` in `script.js`:

- `forceScale = 0.32`
- `radiusScale = 0.90`
- `maxDelta = 0.015`
- `addDye = false`

If the tool feels strong, lower `forceScale` to `0.24`. If it feels too weak,
try `0.40` before changing the global fluid settings.

## Conservation regression check

Run `node tests/paint-volume.cjs` with Chrome installed. Set `CHROME_PATH` if
Chrome is outside the default Windows location. The test uses real WebGL and
checks pigment totals, continued motion, adding a second color, edge dragging,
quality changes, clearing, and idle pure-color paint. It exercises native and
manual texture filtering and allows 0.5% error for half-float GPU storage.
It also checks the rendered shades of every preset, custom black/white/dark
colors, black-pigment conservation, and English/Turkish swatch names.

## Palette references and digital colors

MEB's Ebru textbook lists red ochre, yellow oxide, indigo blues, oxide green,
black, white, and floral red, as well as light blue obtained with white:
https://dogm.eba.gov.tr/panel/upload/etkilesimli/kitap/Ebru/unite3/files/basic-html/page21.html

M. Uğur Derman's account describes gülbahar (brick red), lök (lac crimson),
Çamlıca earth (tobacco brown), indigo, black and white:
https://istanbultarihi.ist/assets/uploads/pdf/istanbulda-ebru-sanati-269.pdf

These sources establish pigment families, not exact screen RGB measurements.
The following sRGB values are digital interpretations chosen for a lively,
balanced palette; they are not spectral pigment data or a physical mixing model.

| Pigment family | sRGB |
| --- | --- |
| Red ochre / Gülbahar | `#c94b3c` |
| Yellow ochre | `#e3ad35` |
| Lahor indigo | `#244d80` |
| Ultramarine | `#365fc4` |
| Sap green | `#3d965b` |
| Lac crimson | `#913968` |
| Floral red | `#e44845` |
| Light indigo | `#7eb7d8` |
| Çamlıca earth | `#996535` |
| Soot black | `#242329` |
| Pigment white | `#fffaf0` |
