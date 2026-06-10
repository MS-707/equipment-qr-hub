import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Logo Candidates — Sage',
  robots: { index: false, follow: false },
}

const CANDIDATES = [
  { id: 1, name: 'Sage Leaf', note: 'Botanical mark — ties directly to the name' },
  { id: 2, name: 'S Monogram', note: 'Bold custom letterform' },
  { id: 3, name: 'Safety Shield', note: 'Protection-first identity' },
  { id: 4, name: 'AI Spark', note: 'The Sage assistant persona' },
  { id: 5, name: 'Hard Hat Dome', note: 'Field-crew protective canopy' },
]

export default function LogoPreviewPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white px-5 py-10">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold">Logo candidates</h1>
        <p className="text-sm text-fg-3 mt-1">
          Each shown at app-store size, home-screen size, and in-app nav size. All use the
          existing accent <span className="font-mono text-mytra-purple">#572DFF</span> on{' '}
          <span className="font-mono">#0A0A0A</span>.
        </p>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CANDIDATES.map((c) => (
            <section
              key={c.id}
              className="bg-mytra-card border border-mytra-border rounded-2xl p-5"
            >
              <h2 className="text-sm font-semibold">
                {c.id}. {c.name}
              </h2>
              <p className="text-xs text-fg-3 mt-0.5">{c.note}</p>

              <div className="mt-4 flex items-end gap-4">
                {/* eslint-disable @next/next/no-img-element */}
                <figure className="text-center">
                  <img
                    src={`/logo-candidates/option-${c.id}.svg`}
                    alt={`${c.name} at 160px`}
                    width={160}
                    height={160}
                    className="rounded-[36px] border border-mytra-border"
                  />
                  <figcaption className="text-[10px] text-fg-4 mt-1">512 / store</figcaption>
                </figure>
                <figure className="text-center">
                  <img
                    src={`/logo-candidates/option-${c.id}.svg`}
                    alt={`${c.name} at 64px`}
                    width={64}
                    height={64}
                    className="rounded-[14px] border border-mytra-border"
                  />
                  <figcaption className="text-[10px] text-fg-4 mt-1">home screen</figcaption>
                </figure>
                <figure className="text-center">
                  <img
                    src={`/logo-candidates/option-${c.id}.svg`}
                    alt={`${c.name} at 32px`}
                    width={32}
                    height={32}
                    className="rounded-md border border-mytra-border"
                  />
                  <figcaption className="text-[10px] text-fg-4 mt-1">nav</figcaption>
                </figure>
                {/* eslint-enable @next/next/no-img-element */}
              </div>
            </section>
          ))}

          <section className="bg-mytra-card border border-mytra-border rounded-2xl p-5 opacity-70">
            <h2 className="text-sm font-semibold">Current</h2>
            <p className="text-xs text-fg-3 mt-0.5">Arc + triangle (for comparison)</p>
            <div className="mt-4 flex items-end gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/sage-icon.svg"
                alt="Current icon"
                width={160}
                height={160}
                className="rounded-[36px] border border-mytra-border"
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
