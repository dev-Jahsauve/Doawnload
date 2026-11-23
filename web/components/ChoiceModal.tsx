"use client";

import { AnimatePresence, motion } from "framer-motion";

interface ChoiceModalProps {
  open: boolean;
  onStandard: () => void;
  onPriority: () => void;
  onClose: () => void;
}

export default function ChoiceModal({ open, onStandard, onPriority, onClose }: ChoiceModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-md rounded-2xl border border-line bg-card p-6 shadow-card"
            initial={{ y: 40, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Choisir le mode de téléchargement"
          >
            <h2 className="text-lg font-semibold">Ton fichier est prêt à partir</h2>
            <p className="mt-1 text-sm text-muted">Choisis ton mode de telechargement.</p>

            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={onPriority}
                className="w-full rounded-xl bg-accent px-4 py-3.5 text-left text-white transition-transform hover:scale-[1.01] active:scale-[0.99]"
              >
                <span className="block font-medium">Téléchargement prioritaire</span>
                <span className="mt-0.5 block text-sm text-white/80">Regarde une pub : ta demande passe devant la file.</span>
              </button>

              <button
                type="button"
                onClick={onStandard}
                className="w-full rounded-xl border border-line px-4 py-3.5 text-left transition-colors hover:bg-accent-soft"
              >
                <span className="block font-medium">Téléchargement standard</span>
                <span className="mt-0.5 block text-sm text-muted">Gratuit, sans pub. File d'attente normale.</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
