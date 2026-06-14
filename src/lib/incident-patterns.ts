interface RootCause {
  cause: string
  category: 'equipment' | 'process' | 'training' | 'environment' | 'management'
  whyChain: string[]
}

interface CorrectiveAction {
  action: string
  controlLevel: 'elimination' | 'substitution' | 'engineering' | 'administrative' | 'ppe'
  priority: 'immediate' | 'short-term' | 'long-term'
}

interface IncidentAnalysis {
  rootCauses: RootCause[]
  correctiveActions: CorrectiveAction[]
}

interface Pattern {
  keywords: string[]
  secondaryKeywords?: string[]
  analysis: IncidentAnalysis
}

const PATTERNS: Pattern[] = [
  {
    keywords: ['laceration', 'cut', 'slice'],
    secondaryKeywords: ['grinder', 'saw', 'blade', 'angle grinder', 'circular saw'],
    analysis: {
      rootCauses: [
        {
          cause: 'Missing or inadequate machine guarding',
          category: 'equipment',
          whyChain: [
            'Worker contacted rotating blade or abrasive disc',
            'Guard was missing, removed, or improperly adjusted',
            'No pre-use equipment inspection procedure enforced',
          ],
        },
        {
          cause: 'Insufficient operator training verification',
          category: 'training',
          whyChain: [
            'Worker did not follow safe cutting procedure',
            'Training records not verified before task assignment',
            'No competency assessment program for power tool operators',
          ],
        },
      ],
      correctiveActions: [
        { action: 'Install or replace blade guard and ensure anti-kickback device is functional', controlLevel: 'engineering', priority: 'immediate' },
        { action: 'Implement mandatory pre-use tool inspection checklist', controlLevel: 'administrative', priority: 'short-term' },
        { action: 'Require documented competency verification before power tool operation', controlLevel: 'administrative', priority: 'short-term' },
        { action: 'Issue cut-resistant gloves (ANSI A4 or higher) for all cutting operations', controlLevel: 'ppe', priority: 'immediate' },
      ],
    },
  },
  {
    keywords: ['fall', 'fell', 'fallen'],
    secondaryKeywords: ['ladder', 'scaffold', 'scaffolding', 'roof', 'elevated', 'height'],
    analysis: {
      rootCauses: [
        {
          cause: 'Inadequate fall protection system',
          category: 'equipment',
          whyChain: [
            'Worker fell from elevated work surface',
            'Fall protection equipment was missing or not used',
            'No fall protection plan established for the task',
          ],
        },
        {
          cause: 'Equipment inspection deficiency',
          category: 'process',
          whyChain: [
            'Access equipment may have been damaged or improperly set up',
            'Pre-use inspection was not performed or documented',
            'No formal equipment inspection program in place',
          ],
        },
      ],
      correctiveActions: [
        { action: 'Install guardrail systems or safety nets at all open edges above 6 feet', controlLevel: 'engineering', priority: 'immediate' },
        { action: 'Evaluate whether work can be performed from ground level using extending tools', controlLevel: 'elimination', priority: 'short-term' },
        { action: 'Implement daily scaffold/ladder inspection tags with competent person sign-off', controlLevel: 'administrative', priority: 'short-term' },
        { action: 'Require personal fall arrest system (harness, lanyard, anchor) for all work above 6 feet', controlLevel: 'ppe', priority: 'immediate' },
      ],
    },
  },
  {
    keywords: ['struck', 'hit', 'impact'],
    secondaryKeywords: ['overhead', 'crane', 'load', 'falling object', 'dropped', 'rigging'],
    analysis: {
      rootCauses: [
        {
          cause: 'Inadequate overhead work zone controls',
          category: 'process',
          whyChain: [
            'Worker was struck by falling material or object',
            'Exclusion zone was not established or enforced below overhead work',
            'No lift plan or dropped-object prevention plan for the task',
          ],
        },
        {
          cause: 'Missing barricading and warning systems',
          category: 'environment',
          whyChain: [
            'Personnel entered the drop zone',
            'Physical barricades and signage were not in place',
            'Site layout did not separate pedestrian routes from overhead operations',
          ],
        },
      ],
      correctiveActions: [
        { action: 'Redesign work sequence to eliminate overhead/below simultaneous operations', controlLevel: 'elimination', priority: 'short-term' },
        { action: 'Install tool-tethering systems and toe boards on all elevated platforms', controlLevel: 'engineering', priority: 'immediate' },
        { action: 'Establish and barricade controlled access zones below all overhead work', controlLevel: 'engineering', priority: 'immediate' },
        { action: 'Require documented lift plans for all crane and rigging operations', controlLevel: 'administrative', priority: 'short-term' },
      ],
    },
  },
  {
    keywords: ['burn', 'burned', 'thermal'],
    secondaryKeywords: ['weld', 'welding', 'torch', 'hot work', 'plasma', 'brazing'],
    analysis: {
      rootCauses: [
        {
          cause: 'Inadequate hot work safety procedures',
          category: 'process',
          whyChain: [
            'Worker sustained burn injury during hot work operation',
            'Hot work permit conditions were not followed or not established',
            'No formal hot work management program with fire watch requirements',
          ],
        },
        {
          cause: 'Insufficient PPE for hot work task',
          category: 'equipment',
          whyChain: [
            'Exposed skin contacted hot material, sparks, or slag',
            'Appropriate welding PPE was not worn or was inadequate',
            'PPE requirements not defined in task-specific procedures',
          ],
        },
      ],
      correctiveActions: [
        { action: 'Substitute hot work with mechanical connections where feasible', controlLevel: 'substitution', priority: 'long-term' },
        { action: 'Install welding curtains and spark containment barriers', controlLevel: 'engineering', priority: 'immediate' },
        { action: 'Enforce hot work permit system with mandatory fire watch', controlLevel: 'administrative', priority: 'immediate' },
        { action: 'Issue flame-resistant clothing, welding gloves, and face shields for all hot work', controlLevel: 'ppe', priority: 'immediate' },
      ],
    },
  },
  {
    keywords: ['electric', 'shock', 'electrocution', 'arc flash'],
    analysis: {
      rootCauses: [
        {
          cause: 'Failure to de-energize and verify zero energy state',
          category: 'process',
          whyChain: [
            'Worker contacted energized electrical component',
            'Lockout/tagout procedure was not followed',
            'No energy isolation verification step in the work procedure',
          ],
        },
        {
          cause: 'Inadequate electrical hazard identification',
          category: 'management',
          whyChain: [
            'Electrical hazard was not identified during task planning',
            'Pre-task hazard assessment did not include energy source review',
            'Management system lacks mandatory energy source identification for all tasks',
          ],
        },
      ],
      correctiveActions: [
        { action: 'De-energize and apply lockout/tagout before any electrical work', controlLevel: 'elimination', priority: 'immediate' },
        { action: 'Install arc-flash labels and maintain up-to-date short circuit analysis', controlLevel: 'engineering', priority: 'short-term' },
        { action: 'Require qualified electrician verification and energized work permits', controlLevel: 'administrative', priority: 'immediate' },
        { action: 'Provide arc-rated PPE matched to incident energy levels', controlLevel: 'ppe', priority: 'immediate' },
      ],
    },
  },
  {
    keywords: ['caught', 'pinch', 'crush', 'crushed', 'caught-in', 'caught-between'],
    analysis: {
      rootCauses: [
        {
          cause: 'Missing machine guarding or physical barriers',
          category: 'equipment',
          whyChain: [
            'Body part entered pinch point or nip point',
            'Guard was absent, bypassed, or did not cover the hazard zone',
            'Equipment hazard assessment did not identify all pinch points',
          ],
        },
        {
          cause: 'Inadequate lockout/tagout during maintenance',
          category: 'process',
          whyChain: [
            'Equipment moved unexpectedly while worker was in hazard zone',
            'Energy isolation was not performed before maintenance task',
            'No written lockout/tagout procedure exists for this equipment',
          ],
        },
      ],
      correctiveActions: [
        { action: 'Install interlocked guards that prevent operation when guard is open', controlLevel: 'engineering', priority: 'immediate' },
        { action: 'Conduct machine-specific hazard assessment to identify all pinch/nip points', controlLevel: 'administrative', priority: 'short-term' },
        { action: 'Develop equipment-specific lockout/tagout procedures', controlLevel: 'administrative', priority: 'short-term' },
        { action: 'Train all maintenance personnel on energy isolation procedures', controlLevel: 'administrative', priority: 'immediate' },
      ],
    },
  },
  {
    keywords: ['slip', 'trip', 'slipped', 'tripped'],
    analysis: {
      rootCauses: [
        {
          cause: 'Poor housekeeping and walkway maintenance',
          category: 'environment',
          whyChain: [
            'Worker slipped or tripped on walking surface',
            'Debris, cords, hoses, or spills were present in walkway',
            'No regular housekeeping schedule or accountability system in place',
          ],
        },
        {
          cause: 'Inadequate walking surface conditions',
          category: 'environment',
          whyChain: [
            'Walking surface was uneven, wet, or obstructed',
            'Temporary walkways and access routes not properly maintained',
            'Site logistics plan did not designate and maintain pedestrian routes',
          ],
        },
      ],
      correctiveActions: [
        { action: 'Eliminate trip hazards by rerouting cables and hoses overhead or underground', controlLevel: 'elimination', priority: 'short-term' },
        { action: 'Install cable covers, non-slip surfaces, and adequate lighting on all walkways', controlLevel: 'engineering', priority: 'short-term' },
        { action: 'Implement daily housekeeping inspections with documented accountability', controlLevel: 'administrative', priority: 'immediate' },
        { action: 'Require slip-resistant footwear for all site personnel', controlLevel: 'ppe', priority: 'immediate' },
      ],
    },
  },
  {
    keywords: ['exposure', 'inhalation', 'chemical', 'fume', 'dust', 'silica'],
    analysis: {
      rootCauses: [
        {
          cause: 'Inadequate exposure controls and ventilation',
          category: 'environment',
          whyChain: [
            'Worker was exposed to hazardous substance above permissible limits',
            'Engineering controls (ventilation, dust suppression) were not in place',
            'Exposure assessment was not conducted for the task',
          ],
        },
        {
          cause: 'Missing hazard communication',
          category: 'management',
          whyChain: [
            'Worker was not aware of the chemical hazard',
            'Safety Data Sheets were not reviewed during task planning',
            'Hazard communication program does not cover task-level chemical reviews',
          ],
        },
      ],
      correctiveActions: [
        { action: 'Substitute hazardous materials with less toxic alternatives where possible', controlLevel: 'substitution', priority: 'long-term' },
        { action: 'Install local exhaust ventilation or wet methods for dust suppression', controlLevel: 'engineering', priority: 'short-term' },
        { action: 'Conduct exposure monitoring and maintain SDS accessibility at point of use', controlLevel: 'administrative', priority: 'immediate' },
        { action: 'Provide appropriate respiratory protection based on exposure assessment', controlLevel: 'ppe', priority: 'immediate' },
      ],
    },
  },
  {
    keywords: ['strain', 'sprain', 'overexertion', 'lifting', 'back injury', 'ergonomic'],
    analysis: {
      rootCauses: [
        {
          cause: 'Manual handling of excessive loads',
          category: 'process',
          whyChain: [
            'Worker sustained musculoskeletal injury during material handling',
            'Task required manual lifting beyond safe limits',
            'No mechanical lifting aids provided or available for the task',
          ],
        },
        {
          cause: 'Lack of ergonomic task assessment',
          category: 'management',
          whyChain: [
            'Repetitive or awkward postures were required by the work method',
            'Task was not assessed for ergonomic risk factors',
            'No ergonomic assessment program exists for high-risk manual tasks',
          ],
        },
      ],
      correctiveActions: [
        { action: 'Provide mechanical lifting aids (hoists, vacuum lifters, carts) for loads over 35 lbs', controlLevel: 'engineering', priority: 'short-term' },
        { action: 'Redesign work layout to minimize manual material handling distances', controlLevel: 'engineering', priority: 'long-term' },
        { action: 'Implement two-person lift policy and safe lifting technique training', controlLevel: 'administrative', priority: 'immediate' },
        { action: 'Provide back support belts for tasks that cannot be mechanized', controlLevel: 'ppe', priority: 'short-term' },
      ],
    },
  },
  {
    keywords: ['heat', 'heat stress', 'heat stroke', 'dehydration', 'heat exhaustion'],
    analysis: {
      rootCauses: [
        {
          cause: 'Inadequate heat illness prevention program',
          category: 'management',
          whyChain: [
            'Worker suffered heat-related illness during outdoor work',
            'Water, shade, and rest break provisions were insufficient',
            'Heat illness prevention plan was not implemented or enforced',
          ],
        },
        {
          cause: 'Failure to monitor environmental conditions',
          category: 'environment',
          whyChain: [
            'Work continued during high heat conditions without modification',
            'Wet bulb globe temperature was not monitored',
            'No trigger thresholds established for modifying work schedules',
          ],
        },
      ],
      correctiveActions: [
        { action: 'Reschedule heavy exertion tasks to cooler hours (early morning, evening)', controlLevel: 'elimination', priority: 'immediate' },
        { action: 'Install shade structures and misting systems at outdoor work areas', controlLevel: 'engineering', priority: 'short-term' },
        { action: 'Implement mandatory water-rest-shade protocol with acclimatization schedule', controlLevel: 'administrative', priority: 'immediate' },
        { action: 'Provide cooling vests and electrolyte replacement for high-heat operations', controlLevel: 'ppe', priority: 'immediate' },
      ],
    },
  },
]

export function getOfflineAnalysis(incidentType: string, description: string): IncidentAnalysis | null {
  const text = `${incidentType} ${description}`.toLowerCase()

  let bestMatch: Pattern | null = null
  let bestScore = 0

  for (const pattern of PATTERNS) {
    const primaryHits = pattern.keywords.filter((kw) => text.includes(kw)).length
    if (primaryHits === 0) continue

    let score = primaryHits * 2
    if (pattern.secondaryKeywords) {
      score += pattern.secondaryKeywords.filter((kw) => text.includes(kw)).length
    }

    if (score > bestScore) {
      bestScore = score
      bestMatch = pattern
    }
  }

  return bestMatch?.analysis ?? null
}
