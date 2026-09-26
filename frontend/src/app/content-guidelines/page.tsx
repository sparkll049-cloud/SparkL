import LegalLayout from "@/components/legal/LegalLayout";

export default function ContentGuidelinesPage() {
  return (
    <LegalLayout title="Content & Upload Guidelines" lastUpdated="September 26, 2026">
      <p>
        This policy explains what may be posted on SparkL and how reports and
        moderation are handled. It supplements our{" "}
        <a href="/terms" className="text-blue-600 hover:underline">
          Terms of Service
        </a>
        .
      </p>

      <h2>1. Community Purpose</h2>
      <p>
        SparkL is a learning community. Posts should help students understand
        course materials, practise responsibly, find resources, and support
        one another.
      </p>

      <h2>2. Allowed Content</h2>
      <p>Allowed content includes:</p>
      <ul>
        <li>genuine academic questions and explanations;</li>
        <li>study tips, revision plans, and course discussions;</li>
        <li>lawfully obtained past questions and notes;</li>
        <li>original summaries, diagrams, examples, and solutions;</li>
        <li>respectful course, department, and institution discussions; and</li>
        <li>constructive feedback and reports.</li>
      </ul>

      <h2>3. Prohibited Content</h2>
      <p>Do not post:</p>
      <ul>
        <li>live-exam answers, leaked papers, or confidential assessment material;</li>
        <li>material you do not have the right to share;</li>
        <li>plagiarism, impersonation, or content submitted as another person&apos;s work;</li>
        <li>harassment, threats, hate speech, sexual exploitation, or discriminatory abuse;</li>
        <li>private personal information, passwords, financial data, or identity documents;</li>
        <li>scams, malware, phishing links, betting promotions, or spam;</li>
        <li>false allegations presented as fact;</li>
        <li>content encouraging self-harm or violence; or</li>
        <li>material that violates any applicable law or institutional rules.</li>
      </ul>

      <h2>4. Upload Declaration</h2>
      <p>Before uploading, you confirm that:</p>
      <blockquote className="border-l-4 pl-4 italic" style={{ borderColor: "inherit" }}>
        I have the right or permission to upload and share this material. I have
        not included confidential personal information or unlawfully obtained
        examination content. I understand that SparkL may review, watermark,
        transform, remove, or restrict this upload and may respond to rights
        complaints.
      </blockquote>

      <h2>5. Document Quality Labels</h2>
      <p>SparkL may label uploaded material as:</p>
      <ul>
        <li>
          <strong>Uploaded</strong> — supplied by a user and not yet fully
          reviewed.
        </li>
        <li>
          <strong>Reviewed</strong> — checked for basic quality and metadata.
        </li>
        <li>
          <strong>Verified</strong> — reviewed by SparkL or an authorised
          institutional contributor.
        </li>
        <li>
          <strong>Reported</strong> — subject to a quality, rights, or safety
          report.
        </li>
        <li>
          <strong>Restricted</strong> — unavailable while under investigation or
          because access is limited.
        </li>
      </ul>
      <p>
        A &quot;Verified&quot; label does not mean an institution endorses the
        document or that every answer is correct. Always verify important
        information with your lecturer or official course materials.
      </p>

      <h2>6. Moderation</h2>
      <p>
        SparkL may warn, label, reduce distribution, edit formatting, remove,
        restrict, suspend, or terminate accounts that violate these guidelines.
        Serious cases — including leaked examination content, copyright
        infringement, and safety threats — may be referred to institutions,
        rights holders, payment providers, regulators, or law enforcement where
        lawful and necessary.
      </p>

      <h2>7. Reports and Appeals</h2>
      <p>
        Report content through the in-product report button or through the
        support channel in your account settings. Include the URL or document
        ID, your reason, and any relevant evidence. We may contact you for
        clarification.
      </p>
      <p>
        If your content is removed, you may appeal through the support channel
        within <strong>14 days</strong>. Explain why you believe the action was
        incorrect and provide any supporting information. We may uphold, reverse,
        or modify the decision.
      </p>

      <h2>8. Contributor Reputation and Rewards</h2>
      <p>
        SparkL may award badges, reputation points, credits, or other benefits
        for helpful contributions. Rewards are discretionary, may be corrected
        for fraud or abuse, and are not wages unless a separate written agreement
        states otherwise. Do not manipulate votes, reviews, referrals, or
        download counts.
      </p>

      <h2>9. Changes to These Guidelines</h2>
      <p>
        We may update these guidelines as the community and Service evolve.
        Changes will be posted on this page with a new &quot;Last updated&quot;
        date. Continued use of the Service after changes take effect constitutes
        acceptance of the updated guidelines.
      </p>
    </LegalLayout>
  );
}
