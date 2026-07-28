import LegalLayout from "@/components/legal/LegalLayout";

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" lastUpdated="July 17, 2026">
      <h2>1. Acceptance of Terms</h2>
      <p>
        By creating an account or using SparkL (&quot;the Service&quot;), you
        agree to be bound by these Terms of Service. If you do not agree,
        do not use the Service.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        The Service is intended for students, staff, and prospective
        students of tertiary institutions. You must provide accurate
        information when creating an account.
      </p>

      <h2>3. Your Account</h2>
      <ul>
        <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
        <li>You are responsible for all activity that occurs under your account.</li>
        <li>Notify us immediately of any unauthorized use of your account.</li>
      </ul>

      <h2>4. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Upload content you do not have the right to share.</li>
        <li>
          Use the Service to facilitate exam malpractice, including
          uploading live/current exam questions obtained improperly, or
          soliciting answers during an ongoing examination.
        </li>
        <li>Impersonate any person or misrepresent your institution or affiliation.</li>
        <li>Upload malware, spam, or content that is unlawful, defamatory, or infringing.</li>
        <li>Attempt to gain unauthorized access to the Service or other users&apos; accounts.</li>
        <li>Scrape, resell, or redistribute content from the Service without permission.</li>
      </ul>
      <p>
        See our{" "}
        <a href="/content-guidelines" className="text-blue-600 hover:underline">
          Content &amp; Upload Guidelines
        </a>{" "}
        for more detail on what may and may not be uploaded.
      </p>

      <h2>5. User-Generated Content</h2>
      <p>
        You retain ownership of content you upload, but you grant SparkL a
        worldwide, non-exclusive, royalty-free license to host, display,
        reproduce, and distribute that content on the Service for the
        purpose of operating the platform. You represent that you have the
        right to upload the content you submit.
      </p>

      <h2>6. Content Disclaimer</h2>
      <p>
        Past questions and materials on SparkL are user-submitted and
        provided for study and revision purposes only. We do not guarantee
        the accuracy, completeness, or currency of any content, and past
        questions may not reflect the actual questions used in any current
        or future examination. SparkL is not affiliated with, endorsed by,
        or acting on behalf of any tertiary institution or examination
        body unless explicitly stated.
      </p>

      <h2>7. Intellectual Property</h2>
      <p>
        The SparkL name, logo, and platform design are the property of
        SparkL. You may not use them without our written permission.
      </p>

      <h2>8. Termination</h2>
      <p>
        We may suspend or terminate your account at our discretion if you
        violate these Terms, including uploading infringing content or
        using the Service to facilitate academic dishonesty.
      </p>

      <h2>9. Disclaimer of Warranties</h2>
      <p>
        The Service is provided &quot;as is&quot; without warranties of any
        kind. We do not guarantee that the Service will be uninterrupted,
        error-free, or that any content will lead to particular academic
        results.
      </p>

      <h2>10. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, SparkL shall not be liable
        for any indirect, incidental, or consequential damages arising from
        your use of the Service, including reliance on any user-submitted
        content.
      </p>

      <h2>11. Governing Law</h2>
      <p>
        These Terms are governed by the laws of the Federal Republic of
        Nigeria.
      </p>

      <h2>12. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. Continued use of the
        Service after changes take effect constitutes acceptance of the
        revised Terms.
      </p>
    </LegalLayout>
  );
}