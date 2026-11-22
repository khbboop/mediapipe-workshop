# 07 — sound bloom

Drop in a music file and watch colors push out of a circle in time with the beat and loudness. No camera needed.

**Input:** an audio file (mp3, wav, m4a, …), or the built-in demo beat
**Mapping:** Web Audio `AnalyserNode` → 180 log-spaced frequency bins (30 Hz–16 kHz), 6 bands, RMS level, low-end spectral-flux beat detection
**Output:** three radial looks on a canvas

| Look | What moves |
| --- | --- |
| 스펙트럼 (spectrum) | one bar per frequency; inner colors = current sound, outer colors = recent peaks |
| 블룸 (bloom) | one translucent blob per band, swelling with that band's energy |
| 궤도 (orbit) | low/high contour hills on a ring; each beat launches dots and draws a chord to the previous beat |

## Saving
- **이미지 저장** renders a 2048 × 2048 PNG poster of the current frame.
- **영상 녹화** records the canvas plus audio (WebM or MP4, depending on the browser) until you press it again or the track ends.

Keyboard: `Space` play/pause, `1` `2` `3` switch looks.

## Try changing
- `PALETTES` — add your own six colors (inner → outer).
- `HOLD_DECAY` — how long the outer "afterglow" tiers hang on.
- The beat threshold in `analyze()` (`mean + 1.4 * sd`) — lower it for more beats.
