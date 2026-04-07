import "./globals.css";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { I18nInitializer } from "@/components/I18nInitializer";
import { ThemeInitializer } from "@/components/ThemeInitializer";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata = {
  title: "DMEWS - Disaster Management & Early Warning System",
  description:
    "Disaster Management and Early Warning System for monitoring, alerts, and response coordination.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={sans.variable}>
      <body className="flex min-h-screen flex-col font-sans">
        <ThemeInitializer />
        <I18nInitializer>
          <Nav />
          <main className="min-h-[calc(100vh-4rem)] flex-1">{children}</main>
          <Footer />
        </I18nInitializer>
      </body>
    </html>
  );
}

