import LegalLayout from "@/components/legal/LegalLayout";

export default function RefundPolicyPage() {
  return (
    <LegalLayout title="Refund & Cancellation Policy" lastUpdated="September 26, 2026">
      <h2>1. Free and Paid Features</h2>
      <p>
        SparkL offers free access to core features. Where we offer paid plans
        or one-time purchases, this policy explains how refunds and
        cancellations are handled. This policy supplements our{" "}
        <a href="/terms" className="text-blue-600 hover:underline">
          Terms of Service
        </a>{" "}
        and applies alongside any mandatory rights you have under Nigerian
        consumer law.
      </p>

      <h2>2. Subscription Cancellations</h2>
      <p>
        You may cancel a paid subscription at any time from your account
        settings. Cancellation stops future billing. After cancellation, your
        paid features remain available until the end of the current billing
        period, unless we have suspended access for a serious breach of the
        Terms of Service.
      </p>
      <p>
        Cancellation does not automatically entitle you to a refund for the
        current billing period unless one of the eligibility conditions in
        section 3 applies or required by applicable law.
      </p>

      <h2>3. Refund Eligibility</h2>
      <p>You may be eligible for a refund if:</p>
      <ul>
        <li>you were charged in error or charged twice for the same item;</li>
        <li>
          a paid feature was unavailable or materially non-functional and we
          could not resolve the issue within a reasonable time; or
        </li>
        <li>
          applicable Nigerian consumer law gives you the right to a refund in
          your specific circumstances.
        </li>
      </ul>
      <p>
        Refunds are not provided for change of mind once a purchase has been
        accessed or used, for forgetting to cancel before a renewal, or for
        inability to find a specific past question not listed as included in a
        plan.
      </p>

      <h2>4. How to Request a Refund</h2>
      <p>
        Contact us through the support channel in your account settings or on
        our website within <strong>7 days</strong> of the charge. Include:
      </p>
      <ul>
        <li>the email address on your account;</li>
        <li>the transaction reference or date of the charge;</li>
        <li>the plan you purchased; and</li>
        <li>a brief description of the issue.</li>
      </ul>
      <p>
        We aim to review all requests within 5 business days and will respond
        through the same channel.
      </p>

      <h2>5. Processing Time</h2>
      <p>
        Approved refunds are returned to the original payment method used at
        checkout. Depending on your bank or payment provider, refunds may take
        5&ndash;10 business days to appear in your account. We will confirm
        when a refund has been issued on our end.
      </p>

      <h2>6. Trial Periods</h2>
      <p>
        Where SparkL offers a free trial, no charge is made during the trial
        unless clearly stated otherwise at checkout. If you believe you were
        charged incorrectly during or immediately after a trial period, contact
        us as described in section 4 and we will investigate promptly.
      </p>

      <h2>7. Changes to This Policy</h2>
      <p>
        We may update this policy as our pricing and payment features evolve.
        Changes will be posted on this page with a new &quot;Last updated&quot;
        date.
      </p>
    </LegalLayout>
  );
}
