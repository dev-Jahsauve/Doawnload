"use client";

import { motion } from "framer-motion";
import type { VideoInfo, VideoFormat } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import { ClockIcon, FilmIcon, MusicIcon } from "./icons";

interface VideoPreviewProps {
  info: VideoInfo;
  busy: boolean;
  onPick: (format: VideoFormat) => void;
}

export default function VideoPreview({ info, busy, onPick }: VideoPreviewProps) {
  return (
    <motion.section
      key="preview"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ type: "spring", stiffness: 160, damping: 22 }}
      className="rounded-2xl border border-line bg-card p-4 shadow-card sm:p-5"
      aria-label="Aperçu de la vidéo"
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        <motion.div
          className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-line sm:w-56"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.08 }}
        >
          {info.thumbnail ? (
            <img src={info.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full items-center justify-center text-muted">
              <FilmIcon className="h-8 w-8" />
            </div>
          )}
        </motion.div>

        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 font-semibold leading-snug">{info.title}</h2>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
            <ClockIcon className="h-3.5 w-3.5" />
            {formatDuration(info.duration)}
          </p>
        </div>
      </div>

      <motion.div
        className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } } }}
      >
        {info.formats.map((format) => (
          <motion.button
            key={format.id}
            type="button"
            disabled={busy}
            variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
            whileHover={!busy ? { y: -2 } : undefined}
            whileTap={!busy ? { scale: 0.97 } : undefined}
            onClick={() => onPick(format)}
            className="flex items-center justify-center gap-2 rounded-xl border border-line px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent-soft disabled:opacity-40"
          >
            {format.kind === "audio" ? <MusicIcon className="h-4 w-4 text-accent" /> : <FilmIcon className="h-4 w-4 text-accent" />}
            {format.label}
          </motion.button>
        ))}
      </motion.div>
    </motion.section>
  );
}
