/**
 * Sage eval dataset — THE REWARD FUNCTION.
 *
 * This is the part of the loop only a domain expert can author, and where your
 * value as a safety lead concentrates. Each scenario is a realistic Pre-Task
 * Plan scope drawn from Mytra build/commissioning work, labeled with:
 *
 *   - expected: hazard categories a competent PTP should surface (recall target)
 *   - critical: the subset that MUST appear — missing one is a hard fail
 *
 * Labels are deliberately broader than the literal scope text, because that is
 * what a senior reviewer would add. A naive single-shot generator will miss the
 * non-obvious ones; the loop's job is to recover them. Keep this set small,
 * real, and honest — its quality caps everything downstream.
 *
 * To extend: add anonymized real PTPs. Treat label disagreements as the
 * highest-signal review you can do — that argument IS the work.
 */

export const SCENARIOS = [
  {
    id: 'mezzanine-steel',
    scopeOfWork: 'Bolt up structural steel for a storage mezzanine at 6 m using a scissor lift; set beams with the warehouse overhead crane.',
    location: 'Warehouse bay 3, indoors',
    expected: ['height', 'lifting', 'dropped', 'pinch', 'slips'],
    critical: ['height', 'lifting'],
  },
  {
    id: 'conveyor-weld',
    scopeOfWork: 'Weld and grind brackets onto an existing conveyor frame to mount new sensors.',
    location: 'Mezzanine level, near packaging line',
    expected: ['hotwork', 'silica', 'noise', 'cuts', 'electrical'],
    critical: ['hotwork', 'electrical'],
  },
  {
    id: 'panel-commissioning',
    scopeOfWork: 'Commission the main control cabinet: terminate wiring, energize VFDs, and verify motor rotation.',
    location: 'Electrical room',
    expected: ['electrical', 'pinch'],
    critical: ['electrical'],
  },
  {
    id: 'agv-floor-marking',
    scopeOfWork: 'Lay out and mark AGV travel lanes on the warehouse floor while reach trucks continue stocking adjacent aisles.',
    location: 'Active warehouse, shared aisles',
    expected: ['pit', 'public', 'slips'],
    critical: ['pit'],
  },
  {
    id: 'anchor-drilling',
    scopeOfWork: 'Drill concrete anchors into the slab to fix robot base frames; use a rotary hammer drill.',
    location: 'Production floor',
    expected: ['silica', 'noise', 'manual', 'electrical'],
    critical: ['silica'],
  },
  {
    id: 'sump-entry',
    scopeOfWork: 'Enter the below-grade pump sump to clean debris and inspect the float switch wiring.',
    location: 'Utility sump, below grade',
    expected: ['confined', 'silica', 'electrical', 'slips'],
    critical: ['confined'],
  },
  {
    id: 'outdoor-yard-rigging',
    scopeOfWork: 'Offload steel modules from flatbed trucks in the yard with a mobile crane during a summer heat wave.',
    location: 'Outdoor laydown yard',
    expected: ['lifting', 'dropped', 'public', 'heat', 'pit'],
    critical: ['lifting', 'heat'],
  },
  {
    id: 'pneumatic-gripper',
    scopeOfWork: 'Service a pneumatic gripper arm: depressurize the air line, replace the actuator, recharge and test cycle.',
    location: 'Robotics cell 2',
    expected: ['pressure', 'pinch', 'electrical'],
    critical: ['pressure'],
  },
  {
    id: 'rack-install',
    scopeOfWork: 'Install pallet racking uprights and beams up to 8 m; bolt baseplates and load test bays.',
    location: 'New storage hall',
    expected: ['height', 'lifting', 'dropped', 'pinch', 'manual'],
    critical: ['height'],
  },
  {
    id: 'battery-room',
    scopeOfWork: 'Stand up the AGV charging station: mount chargers, route busbar, and connect the battery bank.',
    location: 'Battery / charging room',
    expected: ['electrical', 'pinch', 'manual'],
    critical: ['electrical'],
  },
]
