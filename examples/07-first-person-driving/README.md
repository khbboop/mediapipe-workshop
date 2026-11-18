# 07 — First-person driving (3D)

A 3D driving game played from the driver's seat, built with [Three.js](https://threejs.org).
Drive down an endless, procedurally generated two-way highway, overtake traffic,
and avoid crashes. Optional: steer with both hands via webcam (MediaPipe).

## Controls

| Key | Action |
| --- | --- |
| `W` / `↑` | Accelerate |
| `S` / `↓` | Brake · reverse |
| `A` `D` / `←` `→` | Steer |
| `Space` | Handbrake |
| `N` | Toggle day / night (headlights, street lamps) |
| `C` | Hand steering via webcam: hold both hands up like a steering wheel |
| `M` | Mute / unmute |
| `R` | Restart |

## What's inside (`game.js`)

- **Road**: a centreline sampled every 2 m from sums of sines for curvature and
  elevation. It's built in 100 m chunks ahead of you and removed behind you
  (road, terrain, guardrails, street lamps, trees).
- **Road-space physics**: the car and all traffic live in `(s, d)` coordinates,
  meaning distance along the road and lateral offset. The car uses a simple
  bicycle model with a grip limit. If you stop steering, the road keeps curving
  away underneath you.
- **Traffic**: same-direction cars follow each other and change lanes. Oncoming
  cars use the left lanes. You score points for overtakes and near misses.
- **Cockpit**: dashboard, A-pillars, bonnet, a steering wheel that turns, and a
  live rear-view mirror (a render target mirrored onto the glass).
- **Hand steering**: the angle of the line between your two wrists is mapped to
  steering. With both hands visible the car accelerates. Uses `../../lib/tracker.js`.

Things to try: change `curvatureAt()` / `elevationAt()` for a twistier road,
tweak `MAX_SPEED` and grip, or map another signal (e.g. `mouthOpen`) to the horn.
