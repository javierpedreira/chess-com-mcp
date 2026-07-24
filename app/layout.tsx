import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Chess.com MCP Server",
  description:
    "Remote Model Context Protocol server for the public Chess.com API.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          margin: 0,
          padding: "3rem 1.5rem",
          lineHeight: 1.6,
          color: "#1a1a1a",
          background: "#fafafa",
        }}
      >
        <main style={{ maxWidth: 720, margin: "0 auto" }}>{children}</main>
      </body>
    </html>
  );
}
