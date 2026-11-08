# Ebru hand-control tuning

This copy keeps the original project untouched and changes only the hand/pinch
interaction.

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
- Idle frames do not run the fluid/advection step. The dye texture stays
  unchanged until a mouse or hand drag moves paint, a drop adds pigment, or
  Clear Paint clears it. Residual flow is cleared when movement stops so it
  cannot dilute settled paint or restart during the next gesture.
- Dye dissipation is also hard-locked to `0.0` in the advection pass and its UI
  control is removed. A bounded low-density coverage curve keeps numerically
  dispersed pigment visible without allowing neon brightness.
- The simulation starts on a neutral light-gray background
  (`BACK_COLOR = 206, 206, 206`).
  Generated pigment intensity is raised from `0.15` to `0.35` so colors remain
  clearly visible against white.
- The control panel includes an English `Clear Paint` button. It clears dye and
  residual fluid motion without stopping hand tracking or changing settings.
- Display colors use a bounded pigment tone map instead of raw additive RGB.
  Overlapping colors retain their hue but cannot become neon-white. The initial
  random-splat multiplier is reduced from `10.0` to `3.0` to avoid excessive
  dye concentration at startup.
- A separate `PAINT COLOR` palette is fixed to the bottom-left corner. Its five
  traditional swatches and native custom color input control new paint drops.
- Bloom and sunray rendering paths are disabled; the interface and cursor use
  solid state changes rather than neon or glow effects.
- The camera button is a toggle. Clicking it while tracking is active stops the
  MediaPipe frame loop, camera stream, and all media tracks; clicking again
  starts a fresh camera session.
- All user-facing camera, tracking, gesture, error, palette, and control labels
  are in English.

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
