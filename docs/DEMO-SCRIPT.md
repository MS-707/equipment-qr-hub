# Live Demo Runbook — Equipment QR Hub / Sage EHS

A presenter-facing script for the 15-minute demo. Written so a non-developer
can run it: every step names what to tap and what the audience should see.
Last updated: July 2026.

## Pre-demo checklist (do this the night before AND 30 minutes out)

**1. Environment flags** (Vercel → Settings → Environment Variables for a
hosted demo, or a local `.env.local`):

| Flag group | Set | Effect |
|---|---|---|
| Sign-in | `ALLOW_DEV_LOGIN=1` (local dev only; production uses Google or `ALLOW_EMAIL_LOGIN=1` + `EMAIL_LOGIN_CODE`) | Password-free demo sign-in |
| AI | `NEXT_PUBLIC_AI_ASSIST=1` + `ANTHROPIC_API_KEY` | "Ask Sage" hazard suggestions — the AI wow moment |
| EHS email | `RESEND_API_KEY` + `EHS_NOTIFY_EMAIL=<your inbox>` | The signed-inspection email lands live on stage (**human step: send one test email the day before and confirm receipt**) |
| Review flow | `NEXT_PUBLIC_EHS_REVIEW=1` (optional) | "Submit for EHS Review" workflow |

**2. Machine-rehearse the wow path** — exit 0 means demo-ready:

```bash
ALLOW_DEV_LOGIN=1 NEXTAUTH_SECRET=dev-only npm run dev    # terminal 1
node scripts/demo/rehearse-inspection.mjs                 # terminal 2
```

**3. Reset the demo device**: avatar menu (top right) → **Delete all local
data** → confirm. This clears prior inspections/records so counters start
clean and the first-run onboarding shows (dismiss it before going on stage,
or keep it as your opening beat).

**4. Preload the QR target**: print the unit-24 label from `/admin/labels`
(Yale ERP030 Electric Forklift) or bookmark `/inspect/24` as the fallback if
the room's lighting defeats the camera.

**5. Charge the phone. Turn on Do Not Disturb.**

## The 15-minute script

1. **Open on the sign-in screen** (fresh browser). Sign in — point out that
   identity rides on every record and signature. *(1 min)*
2. **Dashboard tour**: pending-sync badge, open permits, PTP status tiles.
   One sentence: "everything a crew lead needs before work starts." *(1 min)*
3. **Scan the QR** stuck on the forklift (camera app → `/inspect/24`). The
   checklist is on screen in under two seconds — no app store, no login
   friction (PWA + static page). *(1 min)*
4. **Show the equipment profile link** (unit name in the header → `/equipment/24`):
   OEM manual, PM schedule, status. Then go back to the checklist. *(1 min)*
5. **Run the pre-trip**: name is pre-filled; tap **Start Inspection**; thumb
   through the 26 items tapping **Pass** — call out the glove-sized targets.
   **Stage one critical fail** (e.g. "Horn" → Fail) and type a note; show the
   required-note gate. Flip it back to Pass if you want the "All Clear"
   ending, or keep it to show the work-order path. *(4 min)*
6. **Sign with a finger** — the ESIGN consent line sits right above the pad.
   Tap **Submit Inspection**. *(1 min)*
7. **Result screen**: "All Clear" + **"EHS has been notified by email."**
   Switch to the EHS inbox on the projector — the signed PNG is attached.
   This is the compliance money shot. *(2 min)*
8. **History + export**: `/inspections` → today's record at the top → **Export
   CSV**. "Audit season is a button, not a weekend." *(1 min)*
9. **Ask Sage** (if AI flags set): `/safety/ptp` → add a task step → "Ask Sage
   to suggest hazards." Read one suggestion aloud, point at the advisory
   disclaimer. *(2 min)*
10. **Close on `/admin/labels`**: the printable QR sheet — "deployment is a
    laminator, not an IT project." *(1 min)*

## Mid-demo recovery moves

- **Page refreshed / app crashed?** Refresh again — drafts autosave every few
  seconds. The checklist restores exactly where you were ("Draft restored"
  banner); re-tap the last item and keep talking.
- **Venue Wi-Fi died?** Keep going — that IS the feature. Submit offline: the
  result screen shows "queued and will send automatically when your
  connection returns," and the tab-bar badge counts records waiting to sync.
  Hotspot later and watch it flush.
- **Tapped Fail by accident?** Tap **Pass** on the same item — toggles are
  idempotent. A fail note left behind can be cleared in the same card.
- **Double-submitted?** You can't — submit disables after the first tap and
  drafts are cleared on success. If you re-enter the checklist it starts a
  fresh inspection; the history page shows both records distinctly.
- **QR won't scan** (projector glare)? Use the bookmarked `/inspect/24` —
  identical experience, mention that the printed label encodes the same URL.
- **Email didn't arrive on stage?** The result banner tells you why (queued /
  not configured / failed). Say "it queues offline and retries — here's one I
  sent earlier," and show the pre-sent test email from the checklist step.

## Appendix — nice-to-know

- The camera-based demo unit can be any pre-trip category item; swap the id
  in `/inspect/[id]` (see `/admin/labels` for the full fleet).
- Everything shown is a PWA over static pages — install to home screen from
  the browser menu for the native-feel variant.
- Emergency reset mid-demo: avatar menu → Delete all local data (10 seconds,
  fully rehearsable).
