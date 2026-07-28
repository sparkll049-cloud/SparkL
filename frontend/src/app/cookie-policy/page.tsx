import LegalLayout from "@/components/legal/LegalLayout";

export default function CookiePolicyPage() {
  return (
    <LegalLayout title="Cookie Policy" lastUpdated="July 17, 2026">
      <h2>1. What Are Cookies</h2>
      <p>
        Cookies are small text files stored on your device when you visit a
        website. They help the website remember information about your
        visit.
      </p>

      <h2>2. How We Use Cookies</h2>
      <ul>
        <li>
          <strong>Essential cookies:</strong> required for login sessions
          and core functionality (e.g. keeping you signed in via Supabase
          authentication).
        </li>
        <li>
          <strong>Preference cookies:</strong> remember settings such as
          your selected institution or course.
        </li>
        <li>
          <strong>Analytics cookies:</strong> help us understand how
          students use the Service so we can improve it.
        </li>
      </ul>

      <h2>3. Third-Party Cookies</h2>
      <p>
        Some cookies may be set by third-party service providers we use to
        operate the Service, such as our authentication and hosting
        providers.
      </p>

      <h2>4. Managing Cookies</h2>
      <p>
        You can control or delete cookies through your browser settings.
        Disabling essential cookies may prevent you from logging in or
        using core features of the Service.
      </p>

      <h2>5. Changes to This Policy</h2>
      <p>
        We may update this Cookie Policy from time to time. Changes will be
        posted on this page with a new &quot;Last updated&quot; date.
      </p>
    </LegalLayout>
  );
}