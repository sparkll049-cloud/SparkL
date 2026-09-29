"use client";

// Simple PDF viewer used by the admin answers page.
// Renders the PDF in an iframe — admins are trusted, students never see this.

interface Props {
  url: string;
}

export default function PdfViewer({ url }: Props) {
  return (
    <div
      style={{
        width: "min(90vw, 860px)",
        height: "80vh",
        borderRadius: "0.75rem",
        overflow: "hidden",
        background: "#1e1e2e",
      }}
    >
      <iframe
        src={url}
        title="PDF Viewer"
        style={{ width: "100%", height: "100%", border: "none" }}
      />
    </div>
  );
}
