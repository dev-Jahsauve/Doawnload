"use client";

import { motion } from "framer-motion";

export default function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="font-medium tabular-nums">{value}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-line">
        <motion.div
          className="h-full rounded-full bg-accent"
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ type: "spring", stiffness: 80, damping: 20 }}
        />
      </div>
    </div>
  );
}
