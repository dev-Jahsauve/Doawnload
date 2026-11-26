"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "smartdownload:pwa-dismissed";

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari : mode plein ecran via meta apple-mobile-web-app-capable
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Bouton « Installer SmartDownload ».
 *
 * - Chrome / Edge / Samsung Internet (desktop + Android) : capte l'evenement
 *   natif beforeinstallprompt et declenche la vraie boite d'installation.
 * - iOS / iPadOS : le prompt natif n'existe pas -> affiche un mini-guide
 *   « Sur l'ecran d'accueil » specifique a Safari.
 * - Masque automatiquement si l'app tourne deja en standalone ou apres install.
 */
export default function InstallPwa() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault(); // empeche le mini-infobar automatique de Chrome
      setInstallEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setInstalled(true);
      setVisible(false);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // iOS : pas de beforeinstallprompt -> on propose le guide (une fois par session,
    // sauf si deja installe ou explicitement ferme par l'utilisateur).
    if (isIos() && !isStandalone() && !sessionStorage.getItem(DISMISS_KEY)) {
      const timer = setTimeout(() => setVisible(true), 2500);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", onPrompt);
        window.removeEventListener("appinstalled", onInstalled);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (installEvent) {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setInstallEvent(null);
      setVisible(false);
      return;
    }
    // Pas d'event natif -> guide selon la plateforme
    setShowIosGuide(true);
  }, [installEvent]);

  const dismiss = useCallback(() => {
    setVisible(false);
    sessionStorage.setItem(DISMISS_KEY, "1");
  }, []);

  if (installed || isStandalone() || !visible) return null;

  return (
    <>
      <AnimatePresence>
        <motion.button
          key="install-btn"
          type="button"
          onClick={install}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="hidden items-center gap-1.5 rounded-full border border-accent px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-[color:var(--accent-soft)] sm:flex"
          title="Installer SmartDownload sur ton appareil"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden>
            <path d="M12 4v11" />
            <path d="m7 11 5 5 5-5" />
            <path d="M5 20h14" />
          </svg>
          Installer l&apos;app
        </motion.button>
      </AnimatePresence>

      {/* Version mobile : bouton flottant discret */}
      {visible && !installEvent && isIos() && (
        <motion.button
          type="button"
          onClick={install}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-medium text-[color:var(--accent-ink)] shadow-card sm:hidden"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
            <path d="M12 4v11" />
            <path d="m7 11 5 5 5-5" />
            <path d="M5 20h14" />
          </svg>
          Installer
        </motion.button>
      )}

      <AnimatePresence>
        {showIosGuide && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowIosGuide(false)}
          >
            <motion.div
              className="w-full max-w-sm rounded-2xl border border-line bg-card p-6 shadow-card"
              initial={{ scale: 0.94, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 10 }}
              transition={{ type: "spring", stiffness: 240, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label="Installer SmartDownload sur iPhone ou iPad"
            >
              <div className="flex items-start justify-between">
                <h2 className="text-lg font-semibold">Installer sur iPhone / iPad</h2>
                <button
                  type="button"
                  onClick={() => setShowIosGuide(false)}
                  className="rounded-lg p-1 text-muted hover:text-ink"
                  aria-label="Fermer"
                >
                  ✕
                </button>
              </div>

              <p className="mt-2 text-sm text-muted">
                Sur iPhone et iPad, l&apos;installation passe par Safari — 3 gestes :
              </p>

              <ol className="mt-4 space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-xs font-semibold text-accent">1</span>
                  <span>
                    Appuie sur l&apos;icône <strong>Partager</strong>{" "}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline h-4 w-4 align-[-3px]" aria-hidden><path d="M12 3v12" /><path d="m8 7 4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>{" "}
                    dans la barre de Safari
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-xs font-semibold text-accent">2</span>
                  <span>Fais défiler puis choisis <strong>« Sur l&apos;écran d&apos;accueil »</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-xs font-semibold text-accent">3</span>
                  <span>Appuie sur <strong>Ajouter</strong> — l&apos;app apparaît sur ton écran d&apos;accueil</span>
                </li>
              </ol>

              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                className="mt-5 w-full rounded-xl bg-accent px-4 py-3 font-medium text-[color:var(--accent-ink)]"
              >
                Compris
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
