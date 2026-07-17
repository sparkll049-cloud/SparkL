import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function LegalLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline"
        >
          <ArrowLeft size={16} />
          Back to Home
        </Link>

        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
          {title}
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Last updated: {lastUpdated}
        </p>

        <div className="prose prose-slate mt-8 max-w-none prose-headings:font-semibold prose-headings:text-slate-900 prose-h2:mt-10 prose-h2:text-xl prose-p:text-slate-600 prose-li:text-slate-600">
          {children}
        </div>

        <div className="mt-16 border-t border-slate-200 pt-6 text-sm text-slate-500">
          Questions about this policy? Contact us at{" "}
          <a
            href="mailto:support@sparkl.ng"
            className="font-medium text-blue-600 hover:underline"
          >
            support@sparkl.ng
          </a>
        </div>
      </div>
    </div>
  );
}