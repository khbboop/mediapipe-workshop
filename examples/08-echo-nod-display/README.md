# 08 — ECHO NOD front display

A clickable prototype of the 2.6 : 1 front display from the ECHO NOD feature spec ("차에 들어가는 기능", F1–F8).
While a song plays, the sound-bloom jelly (example 07) fills the screen in the song owner's color and moves with the music.

| Code | Screen | Try |
| --- | --- | --- |
| F1 | 차 등록 — big QR (pattern only, not a real code) | "가족 중 한 명이 앱으로 찍기" |
| F2 | 탑승 인식 — blurred color circles sharpen when confirmed; the driver is automatic | "문 닫기", then "탔어요" per person |
| F3 | 여정의 띠 — time to arrival, a band split into each person's turns, mixed slots for shared songs | "출발" |
| F4 | 재생 중 — owner color + role, title, reason, one line, band position and next color | plays automatically, 30 s per 4-minute slot |
| F5 | 좋다 — the presser's color seeps in from their side; press again while mixing to cancel | tap the right end (passenger) or use the wheel/voice buttons; the driver end only works with "정차 중" on |
| F6 | 노래 도착 — sender-color ripple from the edge, spoken notice, attached message, small slot in the band | "아들이 앱으로 노래 보냄" |
| F7 | 별로 — no visible change; skips only when riding alone | "에코노드, 이 노래 별로야" |
| F8 | 도착 — mixed circle of today's riders and the family-song count, then off | "시동 끄기" |

The page shows only the car screen. Drive it by tapping: the QR (F1), the screen (close the door), each rider circle (F2), and the two 좋다 ends (F5).
Everyone confirmed → it departs and plays on its own; the son's song arrives during the second song; the car arrives at the end.

Presenter keys: `L` passenger 좋다 · `K` wheel button · `V` "에코노드, 좋다" · `N` "별로야" · `S` son sends a song · `→` next song ·
`P` stopped/driving · `F` first day · `A` dad alone · `R` read the line aloud · `M` mute · `1`–`5` jump to F1/F2/F3/F4/F8 ·
`H` shows the hidden control panel (its 그러면 column logs each consequence, marking phone-app hand-offs with 앱). Drop an audio file on the page to use its sound.
Sound is a generated demo beat (each song only changes its speed); load your own file to drive the visuals with it.
Song titles are example data.
