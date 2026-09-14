import type { Metadata } from "next";
import { Geist_Mono, Fraunces, Sora } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ConditionalBackground } from "@/components/ConditionalBackground";
import { EmergencyModeProvider } from "@/components/EmergencyModeProvider";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { EmergencyModeBanner } from "@/components/EmergencyModeBanner";
import { AuthProvider } from "@/components/AuthProvider";

// Sora: geometric sans for all UI/data text — neutral and legible so the flower motif doesn't
// compete with dense transit info. Fraunces: serif display for headlines — its curved, organic
// letterforms are the typographic echo of the tulip's petal shapes.
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tulip — Safety & Journey Planner",
  description: "AI-powered safety and journey planner for female commuters in Delhi NCR.",
};

// Sets data-theme before first paint (default: dark/"Galactic", unless the visitor previously
// chose light). Next.js 16 flags any raw <script> JSX at all (this is what tripped up
// next-themes' internal flash-prevention script, and a hand-rolled one in <head> hit the exact
// same error) — next/script's beforeInteractive strategy is the sanctioned way to run an inline
// script ahead of hydration.
const themeInitScript = `
  try {
    var stored = localStorage.getItem('tulip-theme');
    document.documentElement.setAttribute('data-theme', stored === 'light' ? 'light' : 'dark');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sora.variable} ${fraunces.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ThemeProvider>
          <AuthProvider>
            <EmergencyModeProvider>
              <ServiceWorkerRegister />
              <ConditionalBackground />
              <EmergencyModeBanner />
              {children}
            </EmergencyModeProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
