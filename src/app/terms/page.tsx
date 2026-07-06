'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function TermsOfService() {
  return (
    <main id="main" className="max-w-2xl mx-auto px-4 pt-6 pb-8 space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-mytra-purple hover:underline"
      >
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-fg">Terms of Service</h1>
        <p className="text-xs text-fg-3 mt-1">Last updated: June 2026</p>
      </div>

      <p className="text-sm text-fg-2">
        These terms govern your use of Sage EHS. By using the platform, you agree to
        these terms. If you do not agree, do not use the service.
      </p>

      {/* What Sage EHS Is */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-fg">What Sage EHS Is</h2>
        <p className="text-sm text-fg-2">
          Sage EHS is an environment, health, and safety (EHS) management platform. It
          helps teams create pre-task plans, job hazard analyses, work permits, incident
          reports, equipment inspections, and other safety records. The platform works
          offline and syncs records to your organization&apos;s systems when connected.
        </p>
      </section>

      {/* AI Features -- Important */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-fg">AI Features -- Important</h2>
        <p className="text-sm text-fg-2">
          Sage EHS includes optional AI-powered features such as hazard suggestions,
          atmospheric reading analysis, and incident analysis. These features are
          advisory tools only. They are meant to help -- not replace -- qualified safety
          professionals, competent persons, or proper safety procedures.
        </p>
        <p className="text-sm text-fg-2 font-medium">
          You and your organization remain fully responsible for all safety decisions
          made on the job site. AI suggestions should always be reviewed by qualified
          personnel before being acted on.
        </p>
        <p className="text-sm text-fg-2">
          We do not warrant the accuracy, completeness, or reliability of any
          AI-generated content. AI output may contain errors, omit hazards, or suggest
          controls that are not appropriate for your specific situation. Always apply
          professional judgment.
        </p>
      </section>

      {/* User Responsibilities */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-fg">User Responsibilities</h2>
        <p className="text-sm text-fg-2">When using Sage EHS, you agree to:</p>
        <ul className="list-disc list-inside text-sm text-fg-2 space-y-1 pl-1">
          <li>Enter accurate and complete information in all safety records</li>
          <li>Follow proper safety procedures and applicable regulations at all times</li>
          <li>Use professional judgment when reviewing AI suggestions or any generated content</li>
          <li>Not rely on the app as a substitute for qualified safety professionals or competent persons</li>
          <li>Keep your account credentials secure and not share them with unauthorized users</li>
        </ul>
      </section>

      {/* Data Ownership */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-fg">Data Ownership</h2>
        <p className="text-sm text-fg-2">
          You and your organization retain ownership of all safety records, incident
          reports, signatures, and other data you create in Sage EHS. By using the
          service, you grant us a limited license to process, store, and transmit your
          data solely to provide and improve the service.
        </p>
      </section>

      {/* Service Availability */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-fg">Service Availability</h2>
        <p className="text-sm text-fg-2">
          We aim to keep Sage EHS available and reliable, but we do not guarantee
          uninterrupted service. The app is designed to work offline, so most features
          remain available even without an internet connection. However, features that
          require server connectivity (such as sync, email notifications, and AI
          analysis) depend on network availability and third-party services.
        </p>
      </section>

      {/* Limitation of Liability */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-fg">Limitation of Liability</h2>
        <p className="text-sm text-fg-2">
          Sage EHS is provided &quot;as is&quot; and &quot;as available&quot; without
          warranties of any kind, either express or implied. We are not liable for any
          safety outcomes, workplace incidents, injuries, regulatory penalties, or other
          damages arising from the use of or inability to use the service.
        </p>
        <p className="text-sm text-fg-2">
          To the maximum extent permitted by law, our total liability for any claims
          related to the service is limited to the amount you paid for the service in
          the twelve months preceding the claim, or $100, whichever is greater.
        </p>
      </section>

      {/* Termination */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-fg">Termination</h2>
        <p className="text-sm text-fg-2">
          You may stop using Sage EHS at any time. We may suspend or terminate your
          access if you violate these terms. Upon termination, your locally stored data
          remains on your device. You can export your records before discontinuing use.
        </p>
      </section>

      {/* Governing Law */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-fg">Governing Law</h2>
        <p className="text-sm text-fg-2">
          These terms are governed by the laws of the State of California, without regard to
          conflict-of-law principles. Any disputes will be resolved in the state or
          federal courts located in California.
        </p>
      </section>

      {/* Changes to These Terms */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-fg">Changes to These Terms</h2>
        <p className="text-sm text-fg-2">
          We may update these terms from time to time. When we do, we will update the
          &quot;Last updated&quot; date at the top of this page. Continued use of Sage
          EHS after changes are posted constitutes acceptance of the updated terms.
        </p>
      </section>

    </main>
  )
}
