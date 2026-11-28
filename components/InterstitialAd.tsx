"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAdConfig } from "../lib/useAdConfig";

interface InterstitialAdProps {
  open: boolean;
  onComplete: () => void;
  onCancel: () => void;
}

/**
 * Interstitiel pre-telechargement : slot publicitaire Adsterra si la cle
 * NEXT_PUBLIC_ADSTERRA_PRIORITY_KEY est definie, sinon emplacement recueil.
 * Un compte a rebours evite un clic accidentel et garantit l'exposition.
 */
export default function InterstitialAd({ open, onComplete, onCancel }: InterstitialAdProps) {
  const { bannerKey, invokeUrl: invokeFromEnv } = useAdConfig();
  // Priorite a la cle dediee si fournie, sinon solidarite avec la banner
  const key = process.env.NEXT_PUBLIC_ADSTERRA_PRIORITY_KEY || bannerKey;
  // invoke depuis le domaine du compte Adsterra si fourni, sinon domaine par defaut
  const invokeUrl = invokeFromEnv || `https://www.highperformanceformat.com/${key}/invoke.js`;
  const hostRef = useRef<HTMLDivElement>(null);
  const [seconds, setSeconds] = useState(5);
  const [adSeen, setAdSeen] = useState(false);

  useEffect(() => {
    if (!open) {
      setSeconds(5);
      setAdSeen(false);
      return;
    }
    const timer = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(timer);
          setAdSeen(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [open]);

  useEffect(() => {
    const host = hostRef.current;
    if (!open || !key || !host) return;

    host.innerHTML = "";

    // invoke.js ecrit la creation via document.write : invalide dans le document
    // principal apres chargement. Injection dans une iframe isolee.
    const iframe = document.createElement("iframe");
    iframe.width = "300";
    iframe.height = "250";
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute("scrolling", "no");
    iframe.setAttribute("title", "Publicité");
    iframe.style.border = "0";
    iframe.style.display = "block";
    host.appendChild(iframe);

    const doc = iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(
        `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width"></head>` +
          `<body style="margin:0;padding:0">` +
          `<script type="text/javascript">atOptions = { key: '${key}', format: 'iframe', height: 250, width: 300, params: {} };</` +
          `script>` +
          `<script type="text/javascript" src="${invokeUrl}"></` +
          `script>` +
          `</body></html>`,
      );
      doc.close();
    }
  }, [open, key, invokeUrl]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-sm rounded-2xl border border-line bg-card p-6 text-center shadow-card"
            initial={{ scale: 0.94, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 24 }}
          >
            <p className="text-sm font-medium uppercase tracking-wide text-muted">Téléchargement prioritaire</p>

            <div
              ref={hostRef}
              className="mx-auto mt-4 flex h-[250px] w-[300px] items-center justify-center overflow-hidden rounded-xl border border-line"
            >
              {!key && <span className="ad-placeholder text-sm text-muted">Emplacement publicitaire</span>}
            </div>

            <button
              type="button"
              disabled={!adSeen}
              onClick={onComplete}
              className="mt-5 w-full rounded-xl bg-accent px-4 py-3 font-medium text-[color:var(--accent-ink)] transition disabled:opacity-40"
            >
              {adSeen ? "Lancer le téléchargement" : `Prière de patienter… ${seconds} s`}
            </button>

            <button type="button" onClick={onCancel} className="mt-2 w-full rounded-xl px-4 py-2 text-sm text-muted hover:text-ink">
              Annuler
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
