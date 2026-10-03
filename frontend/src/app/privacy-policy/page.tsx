import LegalLayout from "@/components/legal/LegalLayout";
import { Shield, Eye, Lock, AlertTriangle, Users, Trash2, Mail } from "lucide-react";

// ── Reusable design atoms ─────────────────────────────────────────────────────

function SectionIcon({ icon: Icon, color }: { icon: React.ElementType; color: string }) {
  return (
    <span
      className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl"
      style={{ background: `${color}18` }}
    >
      <Icon className="h-4 w-4" style={{ color }} />
    </span>
  );
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="my-5 flex items-start gap-3 rounded-2xl border px-4 py-4"
      style={{ borderColor: "rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.05)" }}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
      <p className="text-sm leading-relaxed" style={{ color: "var(--sp-text-2, #334155)" }}>
        {children}
      </p>
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="my-5 flex items-start gap-3 rounded-2xl border px-4 py-4"
      style={{ borderColor: "rgba(99,102,241,0.25)", background: "rgba(99,102,241,0.05)" }}
    >
      <Shield className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
      <p className="text-sm leading-relaxed" style={{ color: "var(--sp-text-2, #334155)" }}>
        {children}
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="September 26, 2026">

      {/* Hero summary strip */}
      <div className="not-prose mb-8 grid gap-3 sm:grid-cols-3">
        {[
          { icon: Shield,  color: "#6366F1", label: "Your data is protected",   sub: "We follow NDPA 2023 & NDPR"       },
          { icon: Eye,     color: "#0EA5E9", label: "No selling of your data",  sub: "We never sell personal data"       },
          { icon: Lock,    color: "#10B981", label: "You stay in control",       sub: "Access, correct or delete anytime" },
        ].map(({ icon: Icon, color, label, sub }) => (
          <div
            key={label}
            className="flex items-start gap-3 rounded-2xl border p-4"
            style={{ borderColor: "rgba(99,102,241,0.15)", background: "rgba(99,102,241,0.04)" }}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: `${color}18` }}>
              <Icon className="h-4 w-4" style={{ color }} />
            </span>
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--sp-text, #0f172a)" }}>{label}</p>
              <p className="text-xs" style={{ color: "var(--sp-text-3, #94a3b8)" }}>{sub}</p>
            </div>
          </div>
        ))}
      </div>

      <h2>1. Who Controls Your Data</h2>
      <SectionIcon icon={Users} color="#6366F1" />
      <p>
        SparkL (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is the data
        controller for personal data collected through this Service. You can
        reach us through the contact details at the bottom of this page.
      </p>

      <h2>2. Personal Data We Collect</h2>

      <h3>2.1 Account and Identity Data</h3>
      <ul>
        <li>Name or display name.</li>
        <li>Email address and/or phone number.</li>
        <li>Password credentials in protected form, or authentication-provider identifier.</li>
        <li>
          Profile photo, bio, institution, country, department, programme,
          academic stage, semester, and selected courses.
        </li>
        <li>Verification information where you request or receive a verified status.</li>
        <li>Support messages and account preferences.</li>
      </ul>

      <h3>2.2 Learning and Usage Data</h3>
      <ul>
        <li>Courses viewed or followed.</li>
        <li>Past questions and resources opened.</li>
        <li>Practice attempts, answers, scores, saves, and progress.</li>
        <li>Searches, clicks, timestamps, referrals, and notification preferences.</li>
        <li>Community activity, reports, reputation, and moderation history.</li>
      </ul>

      <h3>2.3 User Content</h3>
      <p>
        We process questions, answers, comments, images, PDFs, notes, documents,
        profile information, and other material you upload or post. Public User
        Content may be visible to other users depending on your settings and the
        feature.
      </p>

      <h3>2.4 Payment and Transaction Data</h3>
      <p>
        Payment processors may provide us with transaction references, plan,
        amount, currency, status, last four digits or payment-token information,
        and billing dates. We do not store your full card number, PIN, CVV, or
        banking password.
      </p>

      <h3>2.5 Device, Technical, and Security Data</h3>
      <ul>
        <li>IP address and approximate location derived from IP.</li>
        <li>Browser, operating system, device type, language, and app version.</li>
        <li>Cookies, local storage, session identifiers, and similar technologies.</li>
        <li>Logs, error reports, crash data, and performance information.</li>
        <li>Security signals such as unusual login, scraping, or abuse patterns.</li>
      </ul>

      <h3>2.6 Communications and Support</h3>
      <p>
        We collect messages you send to support, feedback and survey responses,
        and records needed to handle rights requests, complaints, payments, and
        safety investigations.
      </p>

      <WarningBox>
        Do not upload medical records, government ID, financial credentials, or
        another person&apos;s sensitive data to any public course or community space.
        We do not intentionally collect sensitive personal data unless necessary,
        lawful, and adequately protected.
      </WarningBox>

      <h2>3. How We Collect Data</h2>
      <p>We collect data:</p>
      <ul>
        <li>directly when you create or update an account;</li>
        <li>when you use the Service, viewer, practice tools, or community;</li>
        <li>when you upload, post, report, or contact us;</li>
        <li>from payment, authentication, hosting, analytics, and security providers; and</li>
        <li>from institutions or moderators where they lawfully provide relevant information.</li>
      </ul>

      <h2>4. Why We Use Your Data</h2>
      <p>We use data to:</p>
      <ol>
        <li>create and secure accounts;</li>
        <li>personalise institution, programme, level, semester, and course content;</li>
        <li>provide document viewing, search, practice, progress, community, upload, and support features;</li>
        <li>process subscriptions, trials, payments, cancellations, refunds, and fraud checks;</li>
        <li>communicate service notices, safety alerts, trial reminders, and support responses;</li>
        <li>moderate content, enforce rules, protect examination integrity, and investigate abuse;</li>
        <li>detect scraping, account sharing, malware, fraud, and security incidents;</li>
        <li>measure performance, improve features, debug errors, and develop new services;</li>
        <li>comply with law, court orders, regulatory requests, and rights notices; and</li>
        <li>protect the rights, safety, and property of SparkL, users, institutions, and the public.</li>
      </ol>

      <InfoBox>
        We may use de-identified or aggregated information for analytics, research,
        and product improvement. We will never use it to re-identify you.
      </InfoBox>

      <h2>5. Lawful Bases for Processing</h2>
      <p>
        We process your personal data in line with the Nigeria Data Protection Act
        2023 (NDPA) and the Nigeria Data Protection Regulation (NDPR), relying on:
      </p>
      <ul>
        <li><strong>Performance of a contract</strong> — to provide the Service you request.</li>
        <li><strong>Consent</strong> — where law requires it or where we request optional marketing or non-essential cookies.</li>
        <li><strong>Legitimate interests</strong> — such as safety, fraud prevention, service improvement, and rights enforcement, balanced against your rights.</li>
        <li><strong>Legal obligations</strong> — where required by applicable law.</li>
      </ul>
      <p>
        You may withdraw consent at any time where consent is the basis. Withdrawal
        does not affect processing already carried out lawfully before withdrawal
        and may mean a particular feature is no longer available.
      </p>

      <h2>6. Public and Private Information</h2>
      <p>
        Your display name, profile image, institution and programme labels, public
        questions, answers, comments, uploads, reactions, and reputation may be
        visible to other users. Do not post anything you expect to remain private.
      </p>
      <p>
        Private account, payment, security, support, and learning records are not
        intended to be public, but no internet transmission is guaranteed to be
        completely secure.
      </p>

      <h2>7. Cookies</h2>
      <p>
        We use strictly necessary cookies for login, security, session management,
        and preferences. With your consent where required, we may use analytics or
        similar technologies to understand usage and improve the Service. You can
        control cookies through your browser or device settings, but disabling
        necessary cookies may prevent some features from working.
      </p>

      <h2>8. Who We Share Data With</h2>
      <p>We do not sell your personal data. We may share data with:</p>
      <ul>
        <li>Cloud hosting, storage, CDN, document-processing, OCR, and security providers (including Supabase and Vercel).</li>
        <li>Authentication, email, and SMS providers.</li>
        <li>Payment processors and fraud-prevention providers.</li>
        <li>Analytics, customer-support, and error-monitoring providers.</li>
        <li>Moderators, trusted contributors, and institution administrators, only as needed for a feature or safety process.</li>
        <li>Professional advisers, auditors, and insurers under confidentiality obligations.</li>
        <li>Law enforcement, courts, regulators, or rights holders where required or permitted by law.</li>
        <li>Other users, only where you make content or profile information public through the Service.</li>
      </ul>
      <p>We do not permit advertising partners to use student learning activity for unrelated targeted advertising.</p>

      <h2>9. Data Retention</h2>
      <p>We keep personal data only as long as reasonably necessary for the purposes described.</p>
      <ul>
        <li><strong>Active account and profile</strong> — retained while your account is active.</li>
        <li><strong>Public community content</strong> — retained until deleted or removed; backup copies may persist temporarily.</li>
        <li><strong>Payment and transaction records</strong> — retained as required for tax, accounting, fraud, and legal obligations.</li>
        <li><strong>Deleted account data</strong> — removed or anonymised within a reasonable period, except where retention is legally required.</li>
        <li><strong>Rights and takedown records</strong> — retained as needed to demonstrate compliance and defend claims.</li>
      </ul>

      <h2>10. Security</h2>
      <SectionIcon icon={Lock} color="#10B981" />
      <p>
        We use reasonable technical and organisational measures, which may include
        access controls, encryption in transit, private storage, expiring tokens,
        watermarked document rendering, logging, backups, rate limits, and staff
        access restrictions. No system is perfectly secure. Do not reuse your
        SparkL password elsewhere.
      </p>
      <p>
        If we become aware of a personal-data incident, we will assess it and
        notify affected people and authorities where required by law.
      </p>

      <h2>11. Your Privacy Rights</h2>
      <p>Under the NDPA, and subject to applicable law and reasonable verification, you may have the right to:</p>
      <ul>
        <li>know whether we process your personal data;</li>
        <li>access a copy of personal data we hold;</li>
        <li>request correction of inaccurate or incomplete data;</li>
        <li>request deletion or erasure;</li>
        <li>restrict or object to certain processing;</li>
        <li>withdraw consent;</li>
        <li>request data portability where applicable;</li>
        <li>object to direct marketing; and</li>
        <li>complain to the Nigeria Data Protection Commission.</li>
      </ul>
      <p>
        To exercise these rights, contact us using the details at the bottom of
        this page. We may need to verify your identity and may lawfully refuse or
        limit a request. We will respond within the period required by applicable law.
      </p>

      <h2>12. Account Deletion</h2>
      <SectionIcon icon={Trash2} color="#EF4444" />
      <p>
        You may request account deletion through your account settings or by
        contacting us. Deletion removes your profile and personal data from active
        systems. We may retain limited information where required for legal
        compliance, fraud prevention, security, payment records, or dispute
        resolution. Where your public contributions are part of a community thread,
        we may anonymise rather than delete them where reasonably possible.
      </p>

      <h2>13. Children&apos;s Privacy</h2>
      <p>
        SparkL is intended for tertiary institution students. We do not knowingly
        collect personal data from children below the minimum age permitted by law
        without the required consent. If we learn that we collected such data, we
        will take reasonable steps to delete it.
      </p>

      <h2>14. Third-Party Links</h2>
      <p>
        The Service may link to third-party sites. Their privacy practices are
        independent of SparkL. Review their policies before submitting personal data.
      </p>

      <h2>15. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy as the Service, law, or our data
        practices change. We will post the updated version with a new &quot;Last
        updated&quot; date. For material changes, we will provide additional notice
        where required by law.
      </p>

      <h2>16. Contact</h2>
      <SectionIcon icon={Mail} color="#6366F1" />
      <p>
        For privacy requests, questions, or complaints, contact SparkL through the
        support channel available in your account settings or on our website. We
        will respond as promptly as we can.
      </p>
    </LegalLayout>
  );
}
