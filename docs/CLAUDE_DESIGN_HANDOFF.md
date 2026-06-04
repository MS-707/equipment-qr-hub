# Claude Design Hand-Off Brief — Safety Hub

> **Status**: Fully functional. Build green, 64 routes, all features working.  
> **Branch**: `claude/construction-safety-audits-HC6MA`  
> **Goal**: Apply the Mytra Design System to every Safety Hub component without touching logic or data flow.

---

## 1. Typography Swap

**Current**: Roboto (`src/app/layout.tsx:7`)  
**Target**: Inter (body/UI) + JetBrains Mono (IDs, timestamps, readings)

| Where | Current | Target |
|---|---|---|
| `layout.tsx` font import | `Roboto` from `next/font/google` | `Inter` + `JetBrains_Mono` |
| Body class | `roboto.className` | `inter.className` |
| Mono spans (record IDs, permit timers, atmospheric readings) | No explicit mono class | Add `font-jetbrains` utility class |

Font size scale reference (Mytra Design System):
- `xs`: 11px, `sm`: 13px, `base`: 15px, `lg`: 18px, `xl`: 22px, `2xl`: 28px

---

## 2. Color Token Mapping

The codebase uses a `mytra-*` Tailwind palette defined in `tailwind.config.ts`. The Mytra Design System refines these values:

| Current Token | Current Value | Design System Target | Notes |
|---|---|---|---|
| `mytra-bg` | `#0A0A0A` | `--surface-primary: #0A0A0A` | Keep |
| `mytra-card` | `#161616` | `--surface-secondary: #111111` | Slightly darker |
| `mytra-card-hover` | `#1E1E1E` | `--surface-tertiary: #1A1A1A` | Adjust |
| `mytra-input` | `#0F0F0F` | `--surface-input: #0D0D0D` | Slightly darker |
| `mytra-border` | `#232323` | `--border-primary: #1F1F1F` | Slightly darker |
| `mytra-purple` | `#583AF6` | `--brand-primary: #572DFF` | Shift bluer |
| `mytra-purple-hover` | `#6B4FF7` | `--brand-hover: #6B42FF` | Adjust |
| `mytra-purple-glow` | `rgba(88,58,246,0.12)` | `--brand-glow: rgba(87,45,255,0.08)` | More subtle |
| — (new) | — | `--border-focus: #572DFF` | Focus rings |
| — (new) | — | `--content-primary: #FFFFFF` | |
| — (new) | — | `--content-secondary: #A1A1A1` | Gray text |
| — (new) | — | `--content-tertiary: #666666` | Subtle labels |
| — (new) | — | `--content-quaternary: #3D3D3D` | Disabled/hints |

Hardcoded gray shades throughout components (`text-gray-400`, `text-gray-500`, `text-gray-600`, `border-gray-700`) should map to these content/border tokens.

---

## 3. Depth System

The Design System uses a shadow + glow layering system. Current code has no shadows.

| Level | CSS | Where to apply |
|---|---|---|
| Depth-1 | `shadow-[0_1px_2px_rgba(0,0,0,0.3)]` | Cards, checklist items |
| Depth-2 | `shadow-[0_4px_12px_rgba(0,0,0,0.4)]` | Modals, expanded panels, Sage results |
| Depth-3 | `shadow-[0_8px_24px_rgba(0,0,0,0.5)]` | Dropdowns, UserMenu |
| Glow (purple) | `shadow-[0_0_20px_rgba(87,45,255,0.15)]` | Primary CTA buttons, active permit badge |

---

## 4. Component Inventory & What Needs Restyling

### Layout / Chrome (4 files)
| File | What to restyle |
|---|---|
| `src/app/layout.tsx` | Font swap, bg color token |
| `src/components/NavHeader.tsx` | Border token, badge color, shadow depth-1 |
| `src/components/AuthGate.tsx` | Card bg, input styling, button styling, offline banners |
| `src/components/UserMenu.tsx` | Dropdown bg/border, shadow depth-3, avatar ring |

### Shared UI Primitives (7 files)
| File | What to restyle |
|---|---|
| `src/components/SignaturePad.tsx` | Border, bg, button tokens |
| `src/components/safety/ChipMultiSelect.tsx` | Chip bg/border/selected states, focus ring |
| `src/components/safety/PPESelector.tsx` | Same chip pattern as ChipMultiSelect |
| `src/components/safety/PermitChecklist.tsx` | Checkbox accent, card bg, critical badge, notes input |
| `src/components/safety/HazardTable.tsx` | Row bg, risk-level segmented toggle, quick-add chips |
| `src/components/safety/CrewSignatureBlock.tsx` | Existing sigs card, add-form card, role select, inputs |
| `src/components/safety/FormSuccess.tsx` | Success icon color, button group, card bg |

### Dashboard & List Views (4 files)
| File | What to restyle |
|---|---|
| `src/components/safety/SafetyDashboard.tsx` | StatCard bg/border/depth, quick-action grid, active-permits cards |
| `src/components/safety/SafetyRecordCard.tsx` | Row bg, type icon color, sync-status dot, permit badge |
| `src/components/safety/SafetyHistory.tsx` | Filter chips, search input, CSV export button |
| `src/components/safety/RecordView.tsx` | Section headers, field labels, signature gallery, audit trail, action buttons |

### Status / Feedback (3 files)
| File | What to restyle |
|---|---|
| `src/components/safety/PermitStatusBadge.tsx` | Badge bg/text colors (keep semantic), pill radius |
| `src/components/safety/PermitTimer.tsx` | Countdown text color, expired state |
| `src/components/safety/SageAssist.tsx` | Ghost button glow, results card depth-2, checkbox accent |

### Form Pages (5 files — heavy lifting)
| File | Key elements |
|---|---|
| `src/components/safety/PreTaskPlanForm.tsx` | Inputs, textareas, section headers, step indicator, heat-illness toggles |
| `src/components/safety/HeightPermitForm.tsx` | Inputs, ChipMultiSelect instances, textarea, validity datetime-local |
| `src/components/safety/HotWorkPermitForm.tsx` | Same pattern as Height + fire-watch fields |
| `src/components/safety/ConfinedSpaceForm.tsx` | Atmospheric readings (with red out-of-range), same permit pattern |
| `src/components/safety/IncidentReportForm.tsx` | Severity segmented toggle, photo upload, witness chips, Cal/OSHA banner |

---

## 5. Recurring className Patterns to Search-Replace

These patterns appear across all form components and should be updated globally:

```
// Input fields
"w-full bg-mytra-input border border-mytra-border rounded-lg px-3 py-2.5 text-sm text-white ..."
→ Update: bg token, border token, add focus:ring-1 focus:ring-[--border-focus], font Inter

// Section headers  
"text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2 px-1"
→ Update: text color to content-tertiary

// Card containers
"bg-mytra-card border border-mytra-border rounded-lg p-3"  
→ Update: bg/border tokens, add depth-1 shadow

// Primary buttons
"bg-mytra-purple text-white hover:bg-mytra-purple-hover"
→ Update: brand tokens, add glow shadow on hover

// Ghost/secondary buttons
"bg-mytra-bg border border-mytra-border text-gray-300 hover:text-white"
→ Update: surface/border/content tokens

// Accent text
"text-mytra-purple" → brand-primary
"text-gray-400" → content-secondary  
"text-gray-500" → content-tertiary
"text-gray-600" → content-quaternary
```

---

## 6. Animations (already defined, keep as-is)

`tailwind.config.ts` defines `fadeIn`, `slideDown`, `fadeInUp`. These are fine — the Design System doesn't specify alternatives. Consider adding a subtle scale-in for Sage results panel.

---

## 7. DO NOT Touch

- **Logic, state management, data flow** — all wiring is complete and tested
- **safety-types.ts, safety-records.ts, safety-sync.ts** — pure data layer, no UI
- **safety-checklists.ts, crew.ts** — data definitions
- **API routes** (`/api/auth`, `/api/safety/*`) — server-only
- **lib/identity.ts, lib/media.ts, lib/datetime.ts, lib/auth.ts** — utilities
- **Color maps** (RISK_COLORS, PERMIT_STATUS_COLORS, etc.) — semantic, not brand

---

## 8. Build & Test

```bash
npm run build          # must stay green, 64 routes
npm run dev            # test at http://localhost:3000/safety
```

No test suite exists — verify visually on mobile viewport (375px) and desktop. Key flows:
1. Sign in (dev login if no Google creds)
2. Create a PTP (fill scope → add hazards → sign)  
3. Open a height permit (checklist → sign → see timer)
4. View `/safety/history` (filter, search)
5. Open a record → print view
6. Sage button visible when `NEXT_PUBLIC_AI_ASSIST=1`
