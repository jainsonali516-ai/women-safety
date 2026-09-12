import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ConditionalBackground } from "@/components/ConditionalBackground";
import { EmergencyModeProvider } from "@/components/EmergencyModeProvider";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { EmergencyModeBanner } from "@/components/EmergencyModeBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
// chose light). Runs from a Server Component, which Next.js 16 allows — a Client Component
// rendering the same raw <script> tag (as next-themes did internally) triggers a hydration
// error there, which is what this replaced.
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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <EmergencyModeProvider>
            <ServiceWorkerRegister />
            <ConditionalBackground />
            <EmergencyModeBanner />
            {children}
          </EmergencyModeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
