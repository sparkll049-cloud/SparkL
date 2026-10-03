import LegalLayout from "@/components/legal/LegalLayout";
import {
  Shield, AlertTriangle, Ban, BookOpen,
  Upload, Users, CreditCard, Gavel, Mail,
} from "lucide-react";

// ── Design atoms ──────────────────────────────────────────────────────────────

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

export default function TermsOfServicePage() {
  return (
    <LegalLayout title="Terms of Service" lastUpdated="September 26, 2026">

      {/* Hero summary strip */}
      <div className="not-prose mb-8 grid gap-3 sm:grid-cols-3">
        {[
          { icon: BookOpen,    color: "#6366F1", label: "For students only",         sub: "Tertiary institution use only"         },
          { icon: Shield,      color: "#10B981", label: "Content integrity matters", sub: "Only upload original, accurate papers" },
          { icon: Ban,         color: "#EF4444", label: "Zero tolerance for abuse",  sub: "Violations lead to permanent bans"     },
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

      <h2>1. Agreement to These Terms</h2>
      <p>
        By accessing or using SparkL (&quot;Service&quot;, &quot;Platform&quot;,
        &quot;we&quot;, &quot;us&quot;, &quot;our&quot;), you agree to be bound by
        these Terms of Service (&quot;Terms&quot;). If you do not agree, do not use
        the Service.
      </p>
      <p>
        These Terms apply to all users — free, trial, and paid — and govern your use
        of every feature, including course browsing, past question access, community
        participation, uploads, the AI Cram tool, and subscriptions.
      </p>

      <InfoBox>
        By creating an account or continuing to use SparkL after an update to these
        Terms, you confirm that you have read, understood, and agreed to them.
      </InfoBox>

      <h2>2. Eligibility</h2>
      <SectionIcon icon={BookOpen} color="#6366F1" />
      <p>You may use SparkL only if:</p>
      <ul>
        <li>you are enrolled in, or preparing for enrolment in, a tertiary institution in Nigeria or an equivalent institution;</li>
        <li>you are at least 16 years old, or the minimum age required by law in your jurisdiction;</li>
        <li>you have the legal capacity to enter into a binding agreement; and</li>
        <li>your account has not previously been suspended or terminated by SparkL for a breach of these Terms.</li>
      </ul>
      <p>
        SparkL is not intended for primary or secondary school students, or for
        commercial training organisations reselling access to their clients.
      </p>

      <WarningBox>
        Creating a new account after a permanent suspension is a breach of these Terms
        and may result in legal action. Do not attempt to circumvent a ban.
      </WarningBox>

      <h2>3. Your Account</h2>
      <p>
        You are responsible for all activity that occurs under your account. When
        creating and maintaining your account you must:
      </p>
      <ul>
        <li>provide accurate, current, and complete registration information;</li>
        <li>keep your password confidential and not share it with any other person;</li>
        <li>notify us immediately if you suspect unauthorised access to your account; and</li>
        <li>not create more than one account per person without our express written permission.</li>
      </ul>
      <p>
        We reserve the right to verify your institution, department, or level
        information at any time. Providing false academic details is a breach of
        these Terms and may result in account suspension.
      </p>

      <h2>4. Acceptable Use</h2>
      <SectionIcon icon={Shield} color="#10B981" />
      <p>You agree to use SparkL only for lawful, personal academic purposes. You must not:</p>
      <ul>
        <li>share, sell, or transfer your account credentials or subscription access to any other person;</li>
        <li>use the platform to cheat in, circumvent, or compromise any examination or academic assessment;</li>
        <li>upload, post, or distribute content you do not own or have the right to share;</li>
        <li>upload content that is false, misleading, fabricated, or does not accurately represent a past question or answer;</li>
        <li>scrape, crawl, bulk-download, or otherwise extract content from the Service by automated or manual means beyond normal browsing;</li>
        <li>reverse engineer, decompile, copy, or reproduce any part of the Service or its content;</li>
        <li>redistribute or republish SparkL content on any other platform, website, or channel;</li>
        <li>use the Service to build or assist in building a competing product or service;</li>
        <li>harass, intimidate, or harm other users through community features;</li>
        <li>post spam, advertisements, or irrelevant content in community discussions;</li>
        <li>impersonate any person, institution, or SparkL staff member;</li>
        <li>attempt to gain unauthorised access to any part of the Service, its infrastructure, or other users&apos; accounts; or</li>
        <li>use the Service in any way that violates applicable Nigerian law or regulation.</li>
      </ul>

      <WarningBox>
        Any attempt to scrape, bulk-download, or systematically extract SparkL content
        — including past questions, answers, or community posts — will result in
        immediate permanent account termination and may expose you to civil or criminal
        liability under Nigerian law.
      </WarningBox>

      <h2>5. Content Uploads and Contributions</h2>
      <SectionIcon icon={Upload} color="#F59E0B" />
      <p>
        When you upload or post content (&quot;User Content&quot;) to SparkL, you confirm that:
      </p>
      <ul>
        <li>the content is an accurate representation of a genuine past examination question, answer, or academic resource;</li>
        <li>you own the content, have the right to share it, or it is not protected by copyright in a way that prevents sharing on an educational platform;</li>
        <li>the content does not contain personal data of third parties, harmful material, obscene content, or material that violates any law; and</li>
        <li>you grant SparkL a non-exclusive, royalty-free, worldwide licence to host, display, process, and moderate the content for the purposes of operating the Service.</li>
      </ul>
      <p>
        We reserve the right to review, edit, reject, or remove any User Content at
        any time without notice, for any reason, including where it breaches these Terms
        or our content standards. Removal of content does not entitle you to a refund
        of any XP, reward, or subscription fee.
      </p>

      <WarningBox>
        Deliberately uploading false, fabricated, or plagiarised content is a serious
        breach. Accounts found doing so will be permanently banned, all earned XP and
        rewards will be revoked, and we reserve the right to recover any financial
        benefit obtained through fraudulent uploads.
      </WarningBox>

      <h2>6. Community Standards</h2>
      <SectionIcon icon={Users} color="#0EA5E9" />
      <p>
        SparkL&apos;s community features — including questions, answers, comments, and
        discussions — are spaces for respectful academic exchange. You agree not to:
      </p>
      <ul>
        <li>post offensive, abusive, discriminatory, or threatening content;</li>
        <li>share another user&apos;s personal information without their consent;</li>
        <li>post content unrelated to academic study, including political content, advertising, or personal solicitation;</li>
        <li>repeatedly report content in bad faith to abuse our moderation system; or</li>
        <li>use community features to organise or promote cheating, exam fraud, or academic dishonesty.</li>
      </ul>
      <p>
        Moderation decisions — including removal of posts, temporary muting, or permanent
        bans — are at SparkL&apos;s sole discretion. Appealing a moderation decision does
        not suspend its effect while the appeal is reviewed.
      </p>

      <h2>7. Subscriptions and Payments</h2>
      <SectionIcon icon={CreditCard} color="#8B5CF6" />
      <p>
        Paid subscription plans are offered on a recurring billing basis. By subscribing, you agree to:
      </p>
      <ul>
        <li>
          <strong>Authorise recurring charges.</strong> You authorise SparkL (via our
          payment processor) to charge your chosen payment method at the start of each
          billing period until you cancel.
        </li>
        <li>
          <strong>One account per subscription.</strong> A subscription is personal.
          Sharing access with other users — whether for free or payment — is strictly
          prohibited and will result in immediate termination without refund.
        </li>
        <li>
          <strong>No resale.</strong> You may not resell, sublicence, or transfer your
          subscription or any paid feature to any other person or entity.
        </li>
        <li>
          <strong>Fair use of premium features.</strong> Paid access to documents, the
          AI Cram tool, and unlimited practice is for your personal academic use only.
          Systematically downloading, copying, or redistributing premium content is
          prohibited regardless of subscription tier.
        </li>
        <li>
          <strong>Cancellation.</strong> You may cancel at any time via account settings.
          Cancellation takes effect at the end of the current billing period. See our{" "}
          <a href="/refund-policy" className="font-semibold text-indigo-600 hover:underline">
            Refund &amp; Cancellation Policy
          </a>{" "}
          for refund eligibility.
        </li>
        <li>
          <strong>Price changes.</strong> We reserve the right to change subscription
          prices. Existing subscribers will receive at least 14 days&apos; notice before
          a price increase applies to their plan.
        </li>
        <li>
          <strong>Suspension for non-payment.</strong> If a payment fails, we may
          immediately restrict access to paid features until payment is resolved.
          Repeated failures may result in account suspension.
        </li>
      </ul>

      <InfoBox>
        Disputes about charges must be raised with SparkL support before initiating
        a chargeback with your bank. Chargebacks filed without first contacting us are
        a breach of these Terms and may result in account suspension. See our{" "}
        <a href="/refund-policy" className="font-semibold text-indigo-600 hover:underline">
          Refund &amp; Cancellation Policy
        </a>{" "}
        for full details.
      </InfoBox>

      <h2>8. Intellectual Property</h2>
      <p>
        All content, design, software, branding, and technology on SparkL — excluding
        User Content — is the property of SparkL or its licensors and is protected by
        applicable intellectual property law. You are granted a limited, non-exclusive,
        non-transferable licence to access and use the Service for personal academic
        purposes only.
      </p>
      <p>This licence does not permit you to:</p>
      <ul>
        <li>copy, reproduce, or republish any SparkL interface, design, or system;</li>
        <li>download or cache content beyond normal browser behaviour;</li>
        <li>remove, alter, or obscure any copyright or attribution notice; or</li>
        <li>use SparkL&apos;s name, logo, or branding without written permission.</li>
      </ul>
      <p>
        Past examination questions uploaded by users may be subject to copyright held
        by the originating institution. SparkL hosts such content for educational
        fair-use purposes. If you are an institution or rights holder and believe your
        content has been uploaded without authorisation, contact us using the details
        in section 13.
      </p>

      <h2>9. Termination and Suspension</h2>
      <SectionIcon icon={Ban} color="#EF4444" />
      <p>
        We may suspend or permanently terminate your account, with or without notice, if:
      </p>
      <ul>
        <li>you breach any provision of these Terms;</li>
        <li>we reasonably suspect fraud, abuse, or illegal activity;</li>
        <li>your account is used in a way that harms other users, institutions, or the integrity of the Service;</li>
        <li>you initiate a chargeback or payment dispute in bad faith; or</li>
        <li>we are required to do so by law or a competent authority.</li>
      </ul>
      <p>
        Upon termination: your access to the Service and all paid features ends
        immediately; you forfeit any remaining subscription period without refund where
        the termination is for cause; and your User Content may be retained or removed
        at our discretion, subject to our Privacy Policy.
      </p>
      <p>
        You may close your account at any time via account settings. Sections 8, 10,
        11, 12, and 13 of these Terms survive termination.
      </p>

      <h2>10. Disclaimers</h2>
      <p>
        SparkL is provided &quot;as is&quot; and &quot;as available&quot; without
        warranties of any kind, express or implied. We do not warrant that:
      </p>
      <ul>
        <li>past questions on the platform are complete, accurate, or up to date;</li>
        <li>AI-generated summaries, flashcards, or explanations are free from error;</li>
        <li>the Service will be available without interruption or error; or</li>
        <li>use of the Service will guarantee any particular academic result.</li>
      </ul>
      <p>
        SparkL is a study aid. You are solely responsible for verifying the accuracy
        of content before relying on it for examination preparation.
      </p>

      <h2>11. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by applicable Nigerian law, SparkL and its
        directors, employees, and partners shall not be liable for any indirect,
        incidental, special, or consequential loss arising from your use of or
        inability to use the Service, including but not limited to loss of data,
        loss of exam performance, or loss of revenue.
      </p>
      <p>
        Our total liability to you for any claim arising from use of the Service shall
        not exceed the total amount you paid to SparkL in the 3 months preceding the
        claim.
      </p>

      <h2>12. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. We will post the updated version
        with a new &quot;Last updated&quot; date. For material changes, we will notify
        you via email or an in-app notice at least 14 days before the change takes
        effect. Continued use of the Service after the effective date constitutes
        acceptance of the updated Terms. If you do not agree to the updated Terms,
        you must stop using the Service and may close your account.
      </p>

      <h2>13. Governing Law and Disputes</h2>
      <SectionIcon icon={Gavel} color="#64748B" />
      <p>
        These Terms are governed by the laws of the Federal Republic of Nigeria.
        Any dispute arising from or in connection with these Terms or your use of
        the Service shall first be referred to SparkL support for resolution. If
        unresolved within 30 days, either party may refer the matter to the competent
        courts of Nigeria.
      </p>
      <p>
        Nothing in these Terms limits any right you have under mandatory Nigerian
        consumer protection law.
      </p>

      <h2>14. Contact</h2>
      <SectionIcon icon={Mail} color="#6366F1" />
      <p>
        For questions about these Terms, to report a violation, or to submit a
        copyright or content takedown request, contact SparkL through the support
        channel in your account settings or on our website. We aim to respond to all
        formal notices within 5 business days.
      </p>
    </LegalLayout>
  );
}
