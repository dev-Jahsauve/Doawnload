import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import Footer from "@/components/Footer";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: {
    default: "SmartDownload — Télécharge une vidéo depuis son lien",
    template: "%s · SmartDownload",
  },
  description:
    "Colle un lien, choisis la qualité, récupère ta vidéo en MP4 ou ton audio en MP3. Gratuit, sans inscription et sans logiciel à installer.",
};

const themeInit = `(function(){try{var t=localStorage.getItem("smartdownload:theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark");}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <header className="border-b border-line">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
            <Logo />
            <div className="flex items-center gap-4">
              <nav className="hidden items-center gap-4 text-sm text-muted sm:flex">
                <Link href="/" className="hover:text-ink">Accueil</Link>
                <Link href="/historique" className="hover:text-ink">Historique</Link>
              </nav>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
