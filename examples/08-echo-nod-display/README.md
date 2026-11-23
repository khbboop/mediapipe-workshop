# 08 — ECHO NOD car screen

A clickable prototype of the ECHO NOD in-car front display (2.2 : 1), built from the team's screen designs and the
front-display spec (F1–F8). Only the screen is shown. The sound-bloom jelly (example 07) runs as a soft background
light behind the player, in the color of whoever picked the song.

Screens follow the spec order, and **only boarding confirmation (F2) moves on its own**; every other step waits for a tap:

| Step | Screen | Tap to go on |
| --- | --- | --- |
| — | logo | anywhere |
| F1 | 차 등록 (QR) | the QR (= scanned with the app), then 홈으로 |
| — | 홈 | 문 닫고 탑승 확인 |
| F2 | 탑승 인식 → 탑승이 확인됐어요 → 오늘 함께하는 사람 | automatic, then 출발하기 |
| F3 | 플레이리스트 조합 → 오늘의 여정 (journey band) | 여정의 띠 보기, 음악 시작 |
| F4 | 재생 중 (player, queue, mini journey band) | the glowing control shows the next step |
| F5 | 좋다: ♥ (passenger 엄마) or mic → "에코노드, 좋다" (driver 아빠); colors mix, tap ♥ again to cancel | 확인 |
| F6 | 노래 도착: ⏭ brings in 올언니's song | + plays it next · 확인 keeps it in the record |
| F7 | 별로: mic → "에코노드, 이 노래 별로야" → 취향 반영 | 확인 |
| F8 | 도착: power icon in the top bar | 홈으로 |

The home icon always returns to the home screen (during a ride it offers "재생 화면으로"). The paper-plane icon opens
노래 건네기 (pick family, add a message, 음악 건네기).

Presenter keys (`H`): Space play/pause · ←/→ songs · `L` F5 · `R` F6 · `N` F7 · `S` send · `E` F8 · `0` home.
Drop an audio file on the page to drive the light with it. Covers are abstract placeholders; song titles are example data.
