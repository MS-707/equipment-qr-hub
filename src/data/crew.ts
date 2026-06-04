/**
 * Optional known-crew roster for quick signature selection.
 *
 * Used by CrewSignatureBlock to autocomplete names when collecting sign-ons.
 * Free-text entry is always allowed, so this list is a convenience, not a
 * gate. Edit freely or wire to a real directory later.
 */

export interface CrewMember {
  name: string
  email?: string
  role?: string
}

export const crewRoster: CrewMember[] = [
  { name: 'Site Supervisor', role: 'Supervisor' },
  { name: 'Foreman', role: 'Foreman' },
  { name: 'Structural Engineer', role: 'Engineer' },
  { name: 'Ironworker', role: 'Crew' },
  { name: 'MEWP Operator', role: 'Operator' },
  { name: 'Fire Watch', role: 'Fire Watch' },
]

export const crewRoles: string[] = [
  'Supervisor',
  'Foreman',
  'Engineer',
  'Crew',
  'Operator',
  'Entrant',
  'Attendant',
  'Fire Watch',
]
