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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
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
