# Ebru hand-control tuning

This copy keeps the original project untouched and changes only the hand/pinch
interaction.

## Interaction model

- Thumb tip + index fingertip pinch behaves like a fine ebru awl (`biz`): it
  drags the existing paint film and is the only gesture that moves paint.
- Thumb tip + middle fingertip pinch adds exactly one paint drop per pinch. It
  does not inject velocity into the fluid. The two gestures are mutually
  exclusive; if both are detected together, neither action runs.
- A drag does not inject a new dye blob on every camera frame.
- Hand impulse is 32% of the original mouse/touch impulse: controlled, but
  strong enough to visibly deform the paint at normal camera frame rates.
- Per-frame movement is capped so tracking jumps cannot sweep the whole tray.
- The contact point is the midpoint between thumb and index fingertips.
- Pinch distance is normalized to hand size and uses separate start/release
  thresholds to avoid flicker.
- Adaptive smoothing and a small dead zone suppress camera jitter.
- A screen-space ebru awl cursor follows the smoothed contact point, changes
  state without glow effects, and disappears when the hand is not detected.
- Dye-density dissipation is disabled (`DENSITY_DISSIPATION = 0.0`), so colors
  are not deliberately faded as simulation time passes.
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
