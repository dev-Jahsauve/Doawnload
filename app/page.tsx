"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import DownloadFlow from "@/components/DownloadFlow";
import HeroBackground from "@/components/HeroBackground";
import NativeBanner from "@/components/NativeBanner";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 140, damping: 20 } },
};

export default function HomePage() {
  // L'espace publicitaire accompagne l'utilisation du service, puis disparait
  // des la fin effective d'un telechargement (signal du flux) jusqu'au reset.
  const [adHidden, setAdHidden] = useState(false);

  return (
    <>
      <HeroBackground />

      <div className="mx-auto w-full max-w-2xl px-6 pb-16">
        <section className="pt-14 sm:pt-20">
          <motion.div variants={container} initial="hidden" animate="show" className="text-center">
            <motion.span
              variants={item}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs font-medium text-muted"
            >
              Gratuit · Sans inscription
            </motion.span>

            <motion.h1
              variants={item}
              className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl"
            >
              Télécharge,
              <br />
              <span className="relative inline-block">
                simplement.
                <motion.span
                  className="absolute -bottom-1 left-0 h-[3px] w-full origin-left rounded-full bg-accent"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.7, duration: 0.5, ease: "easeOut" }}
                />
              </span>
            </motion.h1>

            <motion.p variants={item} className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-muted">
              Colle un lien, choisis la qualité, récupère ton fichier en MP4 ou en MP3.
              Aucun compte, aucun logiciel : tout se passe ici.
            </motion.p>
          </motion.div>

          <div className="mt-9">
            <DownloadFlow onDownloadSettled={() => setAdHidden(true)} onReset={() => setAdHidden(false)} />
          </div>

          <div className="mt-10">
            <NativeBanner hidden={adHidden} />
          </div>

          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.6 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted"
          >
            <li>Aucun fichier conserve plus de 30 min</li>
            <li aria-hidden>·</li>
            <li>Ton historique reste sur ton appareil</li>
            <li aria-hidden>·</li>
            <li>Toutes les grandes plateformes de vidéo prises en charge</li>
          </motion.ul>
        </section>
      </div>
    </>
  );
}
