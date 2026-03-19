import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata = {
  title: "Job Board AI Aggregator",
  description: "AI-powered job board aggregator",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
