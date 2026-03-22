# Equipment QR Hub

Equipment tracking and management system for industrial and manufacturing environments. Digitizes paper-based inspection workflows into a searchable, QR-accessible web application.

**Live:** [equipment-qr-hub.vercel.app](https://equipment-qr-hub.vercel.app)

## What It Does

- **Equipment inventory** — Searchable catalog of all tracked equipment organized by category (machine tools, welding, aerial work platforms, powered industrial trucks, material handling, and more)
- **QR code labels** — Generate and print QR labels for any piece of equipment. Scan with a phone to instantly access its profile, inspection history, and PM schedule.
- **Pre-trip inspections** — Digital inspection checklists that replace paper forms. Timestamped, auditable, tied to specific equipment.
- **Work orders** — Create, assign, and track maintenance work orders with priority levels (Critical/High/Medium/Low) and status tracking.
- **Preventive maintenance schedules** — Daily, weekly, monthly, quarterly, semi-annual, and annual PM tasks per equipment item with due date tracking.
- **Guard status monitoring** — Track machine guarding status across the fleet.
- **Cal/OSHA compliance** — Each equipment item includes relevant Cal/OSHA sections and training requirements.
- **OEM manual access** — Direct links to manufacturer manuals (PDF or web) from each equipment profile.

## Equipment Categories

- Stationary Machine Tools
- Welding
- Air Compressors
- Aerial Work Platforms
- Powered Industrial Trucks (forklifts, pallet jacks)
- Material Handling
- Cordless Power Tools
- Environmental/Test Equipment
- Shop Infrastructure

## Tech Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **QR Generation:** Built-in label component
- **Deployment:** Vercel
- **PWA:** Service worker for offline access

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Key Components

| Component | Purpose |
|-----------|---------|
| `EquipmentCard` | Equipment list item with status badge and category color |
| `EquipmentProfile` | Full equipment detail view with tabs |
| `PreTripInspection` | Digital inspection checklist form |
| `QRLabel` | Printable QR code label generator |
| `WorkOrderBoard` | Kanban-style work order management |
| `PMSchedule` | Preventive maintenance schedule display |
| `StatusToggle` | Equipment active/out-of-service toggle |
| `ComplianceInfo` | Cal/OSHA compliance requirements |
| `TrainingInfo` | Required training for equipment operation |

## License

Internal EHS tool.
