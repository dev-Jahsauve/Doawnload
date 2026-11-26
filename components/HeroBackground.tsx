"use client";

import { motion } from "framer-motion";

/**
 * Fond anime : trois halos ors unis (aplats + flou, aucun d\u00e9grad\u00e9 CSS)
 * qui derive lentement derriere le contenu.
 */
export default function HeroBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <motion.div
        className="halo absolute -top-40 left-[8%] h-[30rem] w-[30rem] rounded-full"
        animate={{ x: [0, 60, -20, 0], y: [0, 30, 60, 0], opacity: [0.55, 0.85, 0.55] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="halo absolute right-[5%] top-[18%] h-[22rem] w-[22rem] rounded-full"
        animate={{ x: [0, -50, 20, 0], y: [0, 40, -30, 0], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="halo absolute bottom-[-8rem] left-[35%] h-[26rem] w-[26rem] rounded-full"
        animate={{ x: [0, 40, -40, 0], y: [0, -30, 10, 0], opacity: [0.5, 0.75, 0.5] }}
        transition={{ duration: 38, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
