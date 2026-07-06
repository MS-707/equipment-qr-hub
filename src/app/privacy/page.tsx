'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyPolicy() {
  return (
    <main className="max-w-2xl mx-auto px-4 pt-6 pb-8 space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-mytra-purple hover:underline"
      >
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-fg">Privacy Policy</h1>
        <p className="text-xs text-fg-3 mt-1">Last updated: July 2026</p>
      </div>

      <p className="text-sm text-fg-2">
        This policy explains what data Sage EHS collects, how we store it, and what
        choices you have. We wrote it in plain language so everyone on your team can
        understand it.
      </p>

      {/* Data We Collect */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-fg">Data We Collect</h2>
        <p className="text-sm text-fg-2">
          Sage EHS collects only what is needed to create and manage safety records:
        </p>
        <ul className="list-disc list-inside text-sm text-fg-2 space-y-1 pl-1">
          <li>Worker names and email addresses</li>
          <li>Digital signatures drawn on screen (used for safety plan acknowledgment)</li>
          <li>Incident reports, which may include injury details, photos, and witness information</li>
          <li>Atmospheric and environmental readings</li>
          <li>Work descriptions, hazard assessments, and permit details</li>
        </ul>
      </section>

      {/* How Data Is Stored */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-fg">How Data Is Stored</h2>
        <p className="text-sm text-fg-2">
          Your safety records are stored primarily on your device using localStorage and
          IndexedDB. This means your data stays with you and works even when you have no
          internet connection.
        </p>
        <p className="text-sm text-fg-2">
          If your organization enables sync, records can also be sent to Notion for
          centralized record management. This is optional and configured by your
          organization.
        </p>
      </section>

      {/* Digital Signatures */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-fg">Digital Signatures</h2>
        <p className="text-sm text-fg-2">
          When crew members sign a pre-task plan or other safety document, the signature
          is captured as an image and stored locally on the device. When you sign a
          pre-trip equipment inspection, the signature image is also attached as a PNG
          to the inspection notification email sent to your EHS team through Resend.
          Signature images are not uploaded by Notion sync and are never sent to AI
          features. They are used solely to document that a worker reviewed and
          acknowledged the record.
        </p>
      </section>

      {/* Third-Party Services */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-fg">Third-Party Services</h2>
        <p className="text-sm text-fg-2">
          Sage EHS integrates with the following services. All are optional and
          controlled by feature flags set by your organization:
        </p>
        <ul className="list-disc list-inside text-sm text-fg-2 space-y-2 pl-1">
          <li>
            <strong>Anthropic Claude API</strong> -- Work descriptions, hazard information,
            incident descriptions, and safety-record context may be sent to
            Anthropic&apos;s Claude AI for analysis and suggestions. That context can
            include worker and supervisor names exactly as they appear on the record
            being analyzed. Data sent to Claude is subject to{' '}
            <a
              href="https://www.anthropic.com/policies"
              target="_blank"
              rel="noopener noreferrer"
              className="text-mytra-purple hover:underline"
            >
              Anthropic&apos;s API data policy
            </a>.
          </li>
          <li>
            <strong>Notion</strong> -- Safety records can be synced to your
            organization&apos;s Notion workspace for centralized access and record keeping.
          </li>
          <li>
            <strong>Resend</strong> -- Used to send email notifications as part of the
            EHS review workflow (for example, notifying a manager that a plan is ready
            for approval).
          </li>
          <li>
            <strong>Slack</strong> -- Optional notifications can be sent to a Slack
            channel when new safety records are submitted. A one-time notification
            containing your name and email is also sent the first time you sign in.
          </li>
          <li>
            <strong>Google</strong> -- Used for OAuth authentication so you can sign in
            with your Google account.
          </li>
          <li>
            <strong>Sentry</strong> -- Error monitoring. When something breaks,
            technical details of the error (stack trace, device and browser
            information) are sent to Sentry so we can diagnose and fix it.
          </li>
          <li>
            <strong>Upstash Redis (Vercel KV)</strong> -- Server-side storage for
            sign-in tracking (name and email, kept 90 days), beta program signups
            (180 days), EHS review submissions (7&ndash;30 days), and rate-limit
            counters.
          </li>
          <li>
            <strong>Vercel</strong> -- Hosts the application. Like any hosting
            provider, it processes requests to serve the app and keeps standard
            server logs.
          </li>
        </ul>
      </section>

      {/* Cookies */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-fg">Cookies</h2>
        <p className="text-sm text-fg-2">
          Sage EHS does not use tracking cookies, analytics cookies, or advertising
          cookies. The only cookie used is a single HTTP-only session cookie for
          authentication when you sign in.
        </p>
      </section>

      {/* AI Features */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-fg">AI Features</h2>
        <p className="text-sm text-fg-2">
          AI-powered features in Sage EHS (such as hazard suggestions, atmospheric
          analysis, and incident analysis) are opt-in and controlled by feature flags.
          All AI suggestions are advisory only and should be reviewed by qualified
          personnel.
        </p>
        <p className="text-sm text-fg-2">
          When AI features are used, the request contains work-related context --
          job descriptions, hazard lists, and atmospheric readings -- and can include
          worker and supervisor names as they appear on the safety record being
          analyzed (for example, a pre-task plan review includes the worker&apos;s name
          and which crew members have signed). Signature images and photos are never
          sent to the AI provider.
        </p>
      </section>

      {/* Data Retention */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-fg">Data Retention</h2>
        <p className="text-sm text-fg-2">
          These are the retention periods the app actually implements:
        </p>
        <ul className="list-disc list-inside text-sm text-fg-2 space-y-1 pl-1">
          <li>
            Safety records on your device that have synced to Notion are automatically
            removed from the device 90 days after creation (the archiver runs when the
            app loads). Records that have never synced stay on your device until you
            clear them.
          </li>
          <li>Unsubmitted form drafts are deleted after 7 days.</li>
          <li>
            Server-side records expire automatically: sign-in tracking after 90 days,
            beta signups after 180 days, EHS review submissions after 7 days (30 days
            once a decision is recorded).
          </li>
          <li>
            Records synced to Notion follow your organization&apos;s Notion workspace
            retention.
          </li>
        </ul>
        <p className="text-sm text-fg-2">
          The app is not your organization&apos;s system of record: OSHA requires longer
          retention for some records (for example, incident reports must be kept five
          years) than a device keeps locally. Use Notion sync and CSV export to
          preserve durable copies. See the{' '}
          <a
            href="https://github.com/MS-707/equipment-qr-hub/blob/main/docs/COMPLIANCE-RETENTION.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-mytra-purple hover:underline"
          >
            compliance &amp; retention mapping
          </a>{' '}
          for how app behavior relates to OSHA record-keeping requirements, and the{' '}
          <a
            href="https://github.com/MS-707/equipment-qr-hub/blob/main/docs/DATA-RETENTION.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-mytra-purple hover:underline"
          >
            store-by-store retention schedule
          </a>{' '}
          for every place data lives.
        </p>
      </section>

      {/* Your Data Rights */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-fg">Your Data Rights</h2>
        <p className="text-sm text-fg-2">
          You can export your safety records at any time using the CSV export feature
          built into the app.
        </p>
      </section>

      {/* Changes to This Policy */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-fg">Changes to This Policy</h2>
        <p className="text-sm text-fg-2">
          We may update this privacy policy from time to time. When we do, we will
          update the &quot;Last updated&quot; date at the top of this page. We encourage
          you to review this policy periodically.
        </p>
      </section>

    </main>
  )
}
