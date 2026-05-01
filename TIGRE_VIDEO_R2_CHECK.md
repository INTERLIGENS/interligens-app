# TIGRE Video R2 Availability Check
Date: 2026-05-01

Bucket: `interligens-static`  
Base URL: `https://pub-bbfbc08b4f584a1a91027b0ca9b696fd.r2.dev`

| # | Vidéo | Nom code (tronqué) | Existe R2 | Status | Action |
|---|-------|--------------------|-----------|--------|--------|
| 1 | GREEN/1 | `1_GREEN_VIDEO_"Good news...this is in the green..."_V2.mp4` | ❌ 404 | MANQUANT | Upload requis ou fallback actif |
| 2 | GREEN/2 | `2_GREEN_VIDEO_(Alright… this looks solid)_V2.mp4` | ✅ 200 | OK | — |
| 3 | GREEN/3 | `3_GREEN_VIDEO_(OKAY,this one lokspretty clean)_V2.mp4` | ✅ 200 | OK | — |
| 4 | GREEN/4 | `4_GREEEN_VIDEO_(Alright — this one's looking legit)_V2..mp4` | ✅ 200 | OK | — |
| 5 | GREEN/5 | `5_GREEN_VIDEO_"Green zone. The evidence looks calm..."_V2.mp4` | ✅ 200 | OK | — |
| 6 | GREEN/6 | `6_GREEN_VIDEO _"Okay… this one's behaving..."_.mp4` | ✅ 200 | OK | — |
| 7 | GREEN/7 | `7_GREEN_VIDEO_"Green. No drama in the evidence..."_.mp4` | ✅ 200 | OK | — |
| 8 | ORANGE/1 | `2_ORANGE_VIDEO_"Orange zone. Not an instant no..."_.mp4` | ✅ 200 | OK | — |
| 9 | ORANGE/2 | `3_ORANGE_VIDEO_"This is orange caution mode..."_.mp4` | ✅ 200 | OK | — |
| 10 | ORANGE/3 | `4_ORANGE_VIDEO_"Orange warning..."_.mp4` | ✅ 200 | OK | — |
| 11 | ORANGE/4 | `5_ORANGE_VIDEO_"Orange. The tiger's watching..."_.mp4` | ✅ 200 | OK | — |
| 12 | ORANGE/5 | `6_ORANGE_VIDEO_We're in orange...gloves on..._.mp4` | ✅ 200 | OK | — |
| 13 | RED/1 | `1_RED_VIDEO.mp4` | ✅ 200 | OK | — |
| 14 | RED/2 | `2_RED_VIDEO_2_RED_VIDEO_"Red zone. Major warnings..."_.mp4` | ❌ 404 | MANQUANT | Upload requis ou fallback actif |
| 15 | RED/3 | `3_RED_VIDEO_"This is red..."_.mp4` | ✅ 200 | OK | — |
| 16 | RED/4 | `4_RED_VIDEO_"Red alert..."_.mp4` | ✅ 200 | OK | — |
| 17 | RED/5 | `5_RED__VIDEO_"Red. Full stop..."_.mp4` | ✅ 200 | OK | — |
| 18 | RED/6 | `6_RED_VIDEO_"Red zone. Sirens off-screen..."_.mp4` | ✅ 200 | OK | — |

## Résumé
- **16/18 vidéos disponibles** (✅)
- **2 manquantes** : GREEN/1 et RED/2
- **Fallback actif** : `onError` dans `TigreVideoPlayer.tsx` — cycle vers la prochaine vidéo du même tier
- **Impact utilisateur** : nul (fallback transparent)

## Fallback confirmé
```
src/components/scan/TigreVideoPlayer.tsx — onError handler présent
```
