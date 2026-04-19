import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Instrument_Serif } from "next/font/google";
import { Providers } from "@/components/providers";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif-display",
  display: "swap",
});

export const metadata = {
  title: "JobBoard AI",
  description: "AI-powered job board aggregator",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning className={instrumentSerif.variable}>
        <body className="bg-background text-foreground antialiased">
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
