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
        <p className="text-xs text-fg-3 mt-1">Last updated: June 2026</p>
      </div>

      <p className="text-sm text-fg-2">
        Sage EHS is built by Mytra AI, Inc. This policy explains what data we collect,
        how we store it, and what choices you have. We wrote it in plain language so
        everyone on your crew can understand it.
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
          is captured as an image and stored locally on the device. Signatures are not
          shared with any external service in the current version. They are used solely
          to document that a worker reviewed and acknowledged a safety plan.
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
            and incident descriptions may be sent to Anthropic&apos;s Claude AI for analysis
            and suggestions. We do not intentionally include personally identifiable
            information (PII) in these requests. Data sent to Claude is subject to{' '}
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
            channel when new safety records are submitted.
          </li>
          <li>
            <strong>Google</strong> -- Used for OAuth authentication so you can sign in
            with your Google account.
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
          When AI features are used, only work-related context is sent to the AI
          provider -- such as job descriptions, hazard lists, and atmospheric readings.
          We do not intentionally send personal information like names, emails, or
          signatures to the AI.
        </p>
      </section>

      {/* Data Retention */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-fg">Data Retention</h2>
        <p className="text-sm text-fg-2">
          Records stored on your device persist until you manually clear them. If your
          organization uses server sync, synced records follow your organization&apos;s
          retention policies.
        </p>
      </section>

      {/* Your Data Rights */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-fg">Your Data Rights</h2>
        <p className="text-sm text-fg-2">
          You can export your safety records at any time using the CSV export feature
          built into the app. If you need to request access to, correction of, or
          deletion of your data, contact us at{' '}
          <a href="mailto:privacy@mytra.ai" className="text-mytra-purple hover:underline">
            privacy@mytra.ai
          </a>.
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

      {/* Contact */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-fg">Contact Us</h2>
        <p className="text-sm text-fg-2">
          If you have questions about this privacy policy or how your data is handled,
          reach out to us at{' '}
          <a href="mailto:privacy@mytra.ai" className="text-mytra-purple hover:underline">
            privacy@mytra.ai
          </a>.
        </p>
      </section>
    </main>
  )
}
