import LegalLayout from "@/components/legal/LegalLayout";

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="July 17, 2026">
      <h2>1. Who We Are</h2>
      <p>
        SparkL (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) provides a
        platform for students at tertiary institutions in Nigeria to access
        and share past examination questions, organized by institution,
        department, and course. This Privacy Policy explains how we collect,
        use, and protect your personal information when you use our website
        and services (the &quot;Service&quot;).
      </p>

      <h2>2. Information We Collect</h2>
      <p>We collect the following categories of information:</p>
      <ul>
        <li>
          <strong>Account information:</strong> full name, email address,
          phone number, password (stored encrypted), institution, department,
          and academic level.
        </li>
        <li>
          <strong>Content you upload:</strong> past questions, course
          materials, and any files or text you submit to the platform.
        </li>
        <li>
          <strong>Usage data:</strong> pages visited, courses viewed,
          searches performed, and general interaction with the Service.
        </li>
        <li>
          <strong>Device and technical data:</strong> IP address, browser
          type, device identifiers, and cookies (see our{" "}
          <a href="/cookie-policy" className="text-blue-600 hover:underline">
            Cookie Policy
          </a>
          ).
        </li>
      </ul>

      <h2>3. How We Use Your Information</h2>
      <ul>
        <li>To create and manage your account.</li>
        <li>To provide, personalize, and improve the Service.</li>
        <li>
          To organize and display uploaded past questions by institution,
          department, and course.
        </li>
        <li>To communicate with you about your account or the Service.</li>
        <li>
          To detect, investigate, and prevent fraud, abuse, or violations of
          our{" "}
          <a href="/terms" className="text-blue-600 hover:underline">
            Terms of Service
          </a>
          .
        </li>
        <li>To comply with legal obligations.</li>
      </ul>

      <h2>4. Legal Basis for Processing</h2>
      <p>
        We process your personal data in line with the Nigeria Data
        Protection Act, 2023 (NDPA) and the Nigeria Data Protection
        Regulation (NDPR), relying on your consent, the necessity of
        processing to perform our contract with you, and our legitimate
        interest in operating and securing the Service.
      </p>

      <h2>5. Sharing of Information</h2>
      <p>
        We do not sell your personal information. We may share limited
        information with:
      </p>
      <ul>
        <li>
          Service providers who help us operate the platform (e.g. hosting,
          database, and analytics providers such as Supabase and Vercel).
        </li>
        <li>Law enforcement or regulators, where legally required.</li>
        <li>
          Other users, but only in the form of content you choose to
          upload or make public (e.g. your uploaded past questions, which
          may display your name as the contributor).
        </li>
      </ul>

      <h2>6. Data Retention</h2>
      <p>
        We retain your account information for as long as your account is
        active. If you delete your account, we will delete or anonymize
        your personal data within a reasonable period, except where we are
        required to retain it by law or to resolve disputes.
      </p>

      <h2>7. Your Rights</h2>
      <p>Under the NDPA, you have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you.</li>
        <li>Request correction of inaccurate data.</li>
        <li>Request deletion of your data, subject to legal exceptions.</li>
        <li>Withdraw consent where processing is based on consent.</li>
        <li>Object to certain types of processing.</li>
      </ul>
      <p>
        To exercise these rights, contact us at{" "}
        <a
          href="mailto:support@sparkl.ng"
          className="text-blue-600 hover:underline"
        >
          support@sparkl.ng
        </a>
        .
      </p>

      <h2>8. Data Security</h2>
      <p>
        We use industry-standard measures, including encryption and access
        controls, to protect your data. No system is completely secure, and
        we cannot guarantee absolute security of information transmitted to
        the Service.
      </p>

      <h2>9. Children&apos;s Privacy</h2>
      <p>
        The Service is intended for tertiary institution students. We do
        not knowingly collect data from children under 13.
      </p>

      <h2>10. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify
        you of material changes by posting the updated policy on this page
        with a new &quot;Last updated&quot; date.
      </p>
    </LegalLayout>
  );
}