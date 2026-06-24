# Sage EHS — automated demo recorder

`record-demo.mjs` drives the app through a scripted 6-beat storyboard and records
video in **both** portrait (1080×1920, for social/mobile) and landscape
(1920×1080, for decks/web). It's deterministic — re-run it after any UI change to
regenerate a clean clip with no fat-finger mistakes.

## Storyboard (~30s per orientation)

| Beat | Shows |
|------|-------|
| 0 | Passwordless sign-in (dev login) |
| 1 | Home / safety dashboard |
| 2 | **SDS** — the dashboard "SDS Library" tile opens the standalone SDS app (`DEMO_SDS_URL`, defaults to the hosted beta) |
| 3 | **Ask Sage** — AI assistant answers a PPE question *(auto-skipped if AI isn't enabled)* |
| 4 | **Report anything** — near-miss incident form, the "report everything" prompt |
| 5 | Outro |

## Setup

```sh
npm i -D playwright
npx playwright install chromium
```

> The script uses the **core `playwright`** library (not `@playwright/test`) and is
> a plain `.mjs`, so it is outside the TypeScript build and never affects CI.

## Run

Start the app locally with the passwordless dev sign-in enabled (the recorder
drives that form — it cannot pass Google/Rippling SSO):

```sh
ALLOW_DEV_LOGIN=1 npm run dev
```

To also capture the **Ask Sage** beat, add the AI flags (otherwise that beat is
skipped gracefully):

```sh
ALLOW_DEV_LOGIN=1 NEXT_PUBLIC_AI_ASSIST=1 ANTHROPIC_API_KEY=sk-ant-... npm run dev
```

Then, in another terminal:

```sh
node scripts/demo/record-demo.mjs
# or against a deployed preview (requires a reachable dev/email login there):
DEMO_BASE_URL=https://your-preview.vercel.app node scripts/demo/record-demo.mjs
```

Output lands in `scripts/demo/out/portrait.webm` and `out/landscape.webm`
(gitignored).

## Convert to mp4 / trim

```sh
ffmpeg -i scripts/demo/out/portrait.webm  -vf "scale=1080:1920" -r 30 portrait.mp4
ffmpeg -i scripts/demo/out/landscape.webm -vf "scale=1920:1080" -r 30 landscape.mp4

# trim to a tight 30s window if needed (start 1.5s, take 30s):
ffmpeg -ss 1.5 -i portrait.mp4 -t 30 -c copy portrait_30s.mp4
```

## Tuning

- Pacing constants at the top of `record-demo.mjs` (`BEAT`, `SHORT`, `TYPE_DELAY`)
  control dwell time — raise/lower to hit exactly 30s.
- Each beat is wrapped in `safe()` so a missing element logs a warning and the
  recording continues rather than aborting.
- The SDS beat navigates to the standalone SDS app (`DEMO_SDS_URL`). Override it
  to point at a different SDS deployment if needed.

## Notes

- For the most *polished* result (auto-zoom on taps, device frame, smooth cursor),
  hand-record with **Screen Studio** on macOS instead — this script is for fast,
  repeatable, consistent captures.
- The recorder runs headless Chromium at a mobile viewport for portrait; the app's
  responsive layout renders its mobile UI (bottom tab bar) below the 640px
  breakpoint and the desktop nav above it (landscape).
