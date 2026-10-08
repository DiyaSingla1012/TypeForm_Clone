import type { Metadata } from "next";
import "./globals.css";
import "./dashboard.css";
import "./respondent.css";
import "./results.css";
import "./experience.css";
import "./dark-theme.css";

export const metadata: Metadata = {
  title: "Forms — Builder",
  description: "A focused form builder",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
