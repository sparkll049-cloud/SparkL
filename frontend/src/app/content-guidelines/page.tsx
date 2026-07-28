import LegalLayout from "@/components/legal/LegalLayout";

export default function ContentGuidelinesPage() {
  return (
    <LegalLayout
      title="Content & Upload Guidelines"
      lastUpdated="July 17, 2026"
    >
      <h2>1. Purpose of SparkL</h2>
      <p>
        SparkL exists to help students revise using past examination
        questions for study and preparation purposes. It is not a tool for
        obtaining unreleased or live exam content, and it is not affiliated
        with any institution&apos;s examination body unless explicitly
        stated.
      </p>

      <h2>2. What You May Upload</h2>
      <ul>
        <li>
          Past questions from examinations that have already been
          administered and concluded.
        </li>
        <li>
          Course materials you created yourself or have permission to
          share.
        </li>
        <li>
          Materials that are publicly available or distributed by your
          institution for study purposes.
        </li>
      </ul>

      <h2>3. What You May Not Upload</h2>
      <ul>
        <li>
          Live or upcoming examination questions, or any material obtained
          through unauthorized access to an institution&apos;s systems.
        </li>
        <li>
          Content that infringes someone else&apos;s copyright, including
          textbooks, lecture slides, or materials explicitly marked
          confidential or restricted by the copyright owner.
        </li>
        <li>Answers or solutions intended to facilitate cheating during an active assessment.</li>
        <li>Personal data of other individuals without their consent.</li>
      </ul>

      <h2>4. Academic Integrity</h2>
      <p>
        SparkL is a study aid. Users remain fully responsible for complying
        with their own institution&apos;s academic integrity policies. We
        do not condone or knowingly facilitate examination malpractice, and
        we reserve the right to remove content and suspend accounts
        associated with such activity.
      </p>

      <h2>5. Copyright &amp; Takedown Requests</h2>
      <p>
        If you believe content on SparkL infringes your copyright or was
        uploaded without authorization (for example, by an institution
        whose past questions were shared without permission), you may
        request removal by contacting{" "}
        <a
          href="mailto:support@sparkl.ng"
          className="text-blue-600 hover:underline"
        >
          support@sparkl.ng
        </a>{" "}
        with:
      </p>
      <ul>
        <li>A description of the content and its location (URL/course) on SparkL.</li>
        <li>Evidence of your ownership or authority over the content.</li>
        <li>Your contact information.</li>
      </ul>
      <p>
        We will review and, where appropriate, remove the content within a
        reasonable timeframe and notify the uploader.
      </p>

      <h2>6. Enforcement</h2>
      <p>
        We reserve the right to remove any content, without prior notice,
        that violates these guidelines, and to suspend or terminate
        accounts of repeat violators.
      </p>
    </LegalLayout>
  );
}