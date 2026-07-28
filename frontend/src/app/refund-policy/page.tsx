import LegalLayout from "@/components/legal/LegalLayout";

export default function RefundPolicyPage() {
  return (
    <LegalLayout title="Refund & Cancellation Policy" lastUpdated="July 17, 2026">
      <h2>1. Free and Paid Features</h2>
      <p>
        SparkL offers free access to core features. Where we introduce paid
        plans or one-time purchases (e.g. premium course packs), this
        policy explains how refunds and cancellations are handled.
      </p>

      <h2>2. Subscription Cancellations</h2>
      <p>
        You may cancel a paid subscription at any time from your account
        settings. Cancellation stops future billing but does not
        automatically refund the current billing period unless required by
        law.
      </p>

      <h2>3. Refund Eligibility</h2>
      <p>You may be eligible for a refund if:</p>
      <ul>
        <li>You were charged in error or charged twice for the same item.</li>
        <li>A paid feature was unavailable or non-functional and we could not resolve the issue within a reasonable time.</li>
      </ul>
      <p>
        Refunds are generally not provided for change of mind after a
        purchase has been used or accessed.
      </p>

      <h2>4. How to Request a Refund</h2>
      <p>
        Contact us at{" "}
        <a
          href="mailto:support@sparkl.ng"
          className="text-blue-600 hover:underline"
        >
          support@sparkl.ng
        </a>{" "}
        within 7 days of the charge, including your account email and
        transaction details. We aim to review requests within 5 business
        days.
      </p>

      <h2>5. Processing Time</h2>
      <p>
        Approved refunds are processed to the original payment method and
        may take 5&ndash;10 business days to reflect, depending on your
        bank or payment provider.
      </p>

      <h2>6. Changes to This Policy</h2>
      <p>
        We may update this policy as our pricing and payment features
        evolve. Changes will be posted on this page with a new &quot;Last
        updated&quot; date.
      </p>
    </LegalLayout>
  );
}