"use client";

import { motion } from "framer-motion";

/**
 * Fond anime discret : trois taches de couleur tres douces qui derivent
 * lentement derriere le contenu.
 */
export default function HeroBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <motion.div
        className="absolute -top-40 left-[8%] h-[34rem] w-[34rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, var(--accent-soft), transparent)" }}
        animate={{ x: [0, 60, -20, 0], y: [0, 30, 60, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute right-[5%] top-[20%] h-[26rem] w-[26rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, var(--accent-soft), transparent)" }}
        animate={{ x: [0, -50, 20, 0], y: [0, 40, -30, 0] }}
        transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-10rem] left-[35%] h-[30rem] w-[30rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, var(--accent-soft), transparent)" }}
        animate={{ x: [0, 40, -40, 0], y: [0, -30, 10, 0] }}
        transition={{ duration: 38, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
