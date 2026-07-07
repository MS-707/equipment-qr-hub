import { ImageResponse } from 'next/og'

/**
 * Branded OG/Twitter preview (DS-10) — generated at build time from the
 * brand tokens (dark surface #0A0A0A, accent #572DFF), no external assets
 * so the CSP stays self-contained. Values mirror the dark-theme tokens in
 * globals.css; this route renders outside the app CSS so the literals are
 * intentional here.
 */

export const runtime = 'edge'
export const alt = 'Sage EHS — AI-powered safety for any workplace'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          backgroundColor: '#0A0A0A',
          backgroundImage: 'radial-gradient(ellipse 60% 50% at 80% 20%, rgba(87,45,255,0.25), transparent)',
          color: '#FFFFFF',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Shield mark */}
          <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#572DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <span style={{ fontSize: 84, fontWeight: 700 }}>Sage</span>
            <span
              style={{
                fontSize: 30,
                fontWeight: 600,
                color: '#B9A5FF',
                backgroundColor: 'rgba(87,45,255,0.25)',
                padding: '6px 18px',
                borderRadius: 10,
              }}
            >
              EHS
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 36, color: '#C9C9C9', marginTop: 28, maxWidth: 900, lineHeight: 1.35 }}>
          Scan. Inspect. Sign. AI-powered safety records for teams in the field — built for gloves, sunlight, and dead zones.
        </div>
        <div style={{ display: 'flex', marginTop: 44, fontSize: 24, color: '#8f8f8f' }}>
          Pre-trip inspections · Permits · JHAs · Incident reports · Toolbox talks
        </div>
      </div>
    ),
    size
  )
}
