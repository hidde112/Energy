import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/app-shell";
import { ThemeProvider } from "@/components/theme-provider";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ENERGYDEX",
    template: "%s · ENERGYDEX",
  },
  description: "Scan, rate, and collect energy drinks with friends.",
};

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0d0c" },
    { media: "(prefers-color-scheme: light)", color: "#f4f7f1" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AppShell>{children}</AppShell>
          <ServiceWorkerRegistration />
        </ThemeProvider>
      </body>
    </html>
  );
}
