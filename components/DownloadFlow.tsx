"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ApiError, api, type VideoFormat, type VideoInfo } from "@/lib/api";
import { isSupportedUrl } from "@/lib/platforms";
import { addHistory } from "@/lib/history";
import { BrandSignature } from "./BrandSignature";
import ProgressBar from "./ProgressBar";
import VideoPreview from "./VideoPreview";
import { ArrowDownIcon, LinkIcon } from "./icons";

type Phase = "idle" | "analyzing" | "ready" | "working" | "done";

interface DownloadFlowProps {
  onDownloadSettled?: () => void;
  onReset?: () => void;
}

export default function DownloadFlow({ onDownloadSettled, onReset }: DownloadFlowProps) {
  const [url, setUrl] = useState("");
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [format, setFormat] = useState<VideoFormat | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const jobIdRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const directCleanupRef = useRef<(() => void) | null>(null);
  const directSettledRef = useRef(false);

  // Pré-remplissage depuis /?url=... (utilisé notamment par la page Historique).
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("url");
    if (initial && isSupportedUrl(initial)) setUrl(initial);
  }, []);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => stopPolling, []);

  const clearDirectWatch = useCallback(() => {
    directCleanupRef.current?.();
    directCleanupRef.current = null;
  }, []);

  useEffect(() => clearDirectWatch, [clearDirectWatch]);

  // Mode direct (serverless) : le fichier transite par un tiers, aucun signal
  // navigateur n'atteste la fin reelle du transfert. Le retour de visibilite ou
  // de focus apres le lancement sert de signal "meilleur effort" (limite
  // documentee dans docs/ads-policy.md) ; le mode taches reste la voie fiable.
  const settleDirect = useCallback(() => {
    if (directSettledRef.current) return;
    directSettledRef.current = true;
    clearDirectWatch();
    setPhase("done");
    onDownloadSettled?.();
  }, [clearDirectWatch, onDownloadSettled]);

  const watchDirectDownload = useCallback(() => {
    directSettledRef.current = false;
    const onVisible = () => {
      if (document.visibilityState === "visible") settleDirect();
    };
    window.addEventListener("pageshow", settleDirect);
    window.addEventListener("focus", settleDirect);
    document.addEventListener("visibilitychange", onVisible);
    directCleanupRef.current = () => {
      window.removeEventListener("pageshow", settleDirect);
      window.removeEventListener("focus", settleDirect);
      document.removeEventListener("visibilitychange", onVisible);
    };
    window.setTimeout(settleDirect, 60_000);
  }, [settleDirect]);

  const startDownload = useCallback(async () => {
    if (!info || !format) return;
    setPhase("working");
    setError("");
    setProgress(0);

    try {
      const response = await api.requestDownload({
        url,
        formatId: format.id,
        title: info.title,
      });

      // Mode serverless (Vercel) : l'extracteur renvoie un lien direct, sans tache ni polling.
      if ("direct" in response && response.url) {
        addHistory({ title: info.title, format: format.label, thumbnail: info.thumbnail, url });
        setPhase("done");
        onDownloadSettled?.();
        window.location.href = response.url;
        watchDirectDownload();
        return;
      }

      const { jobId } = response as { jobId: string };
      jobIdRef.current = jobId;

      const poll = setInterval(async () => {
        try {
          const job = await api.job(jobId);
          setProgress(typeof job.progress === "number" ? Math.max(0, Math.min(100, job.progress)) : 0);

          if (job.state === "completed" && job.result) {
            stopPolling();
            addHistory({ title: info.title, format: format.label, thumbnail: info.thumbnail, url });
            setPhase("done");
            onDownloadSettled?.();
            window.location.href = `/api/jobs/${jobId}/file`;
          } else if (job.state === "failed") {
            stopPolling();
            setError(job.failedReason || "Le téléchargement a échoué.");
            setPhase("ready");
          }
        } catch {
          // erreur réseau passagère : le prochain tick réessaie
        }
      }, 1200);
      pollRef.current = poll;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Connexion au serveur impossible.");
      setPhase("ready");
    }
  }, [format, info, onDownloadSettled, url, watchDirectDownload]);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isSupportedUrl(url)) {
      setError("Ce lien ne provient pas d'une plateforme supportée. Colle un lien de vidéo partagée publiquement.");
      return;
    }

    setPhase("analyzing");
    try {
      const { info: analyzed } = await api.analyze(url);
      if (analyzed.formats.length === 0) {
        setError("Aucun format exploitable pour ce contenu.");
        setPhase("idle");
        return;
      }
      setInfo(analyzed);
      setProgress(0);
      setPhase("ready");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Analyse impossible pour le moment.");
      setPhase("idle");
    }
  };

  const reset = () => {
    stopPolling();
    clearDirectWatch();
    directSettledRef.current = false;
    setUrl("");
    setInfo(null);
    setFormat(null);
    setProgress(0);
    setError("");
    setPhase("idle");
    onReset?.();
  };

  const pickFormat = (f: VideoFormat) => {
    setFormat(f);
    setError("");
  };

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {phase !== "working" && phase !== "done" ? (
          <motion.form
            key="form"
            onSubmit={handleAnalyze}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ type: "spring", stiffness: 160, damping: 22, delay: 0.25 }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
                <LinkIcon className="h-4 w-4" />
              </span>
              <input
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Colle le lien de la vidéo..."
                aria-label="Lien de la vidéo"
                className="h-14 w-full rounded-xl border border-line bg-card pl-11 pr-4 text-[15px] outline-none transition-shadow placeholder:text-muted focus:shadow-card"
              />
            </div>
            <motion.button
              type="submit"
              disabled={phase === "analyzing"}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="flex h-14 items-center justify-center gap-2 rounded-xl bg-accent px-6 font-medium text-[color:var(--accent-ink)] disabled:opacity-50"
            >
              {phase === "analyzing" ? (
                <>
                  <motion.span
                    className="h-4 w-4 rounded-full border-2 border-[color:var(--accent-ink)]/30 border-t-[color:var(--accent-ink)]"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  />
                  Analyse...
                </>
              ) : (
                <>
                  <ArrowDownIcon className="h-4 w-4" />
                  Analyser
                </>
              )}
            </motion.button>
          </motion.form>
        ) : (
          <motion.div key="progress" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-line bg-card p-5 shadow-card">
            <ProgressBar
              value={phase === "done" ? 100 : progress}
              label={
                phase === "done"
                  ? "Fichier prêt, téléchargement lancé"
                  : phase === "working" && progress < 5
                    ? "Préparation du fichier..."
                    : "Téléchargement en cours..."
              }
            />
            <div className="mt-4 flex items-center justify-between">
              <button type="button" onClick={reset} className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
                Nouveau téléchargement
              </button>
              <BrandSignature />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {info && phase === "ready" && <VideoPreview info={info} busy={false} onPick={pickFormat} />}
      </AnimatePresence>

      {info && phase === "ready" && (
        <motion.div
          key="free-download"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4"
        >
          <motion.button
            type="button"
            disabled={!format}
            onClick={() => void startDownload()}
            whileHover={format ? { scale: 1.02 } : undefined}
            whileTap={format ? { scale: 0.97 } : undefined}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-[color:var(--accent-ink)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowDownIcon className="h-5 w-5" />
            Télécharger gratuitement
          </motion.button>
          <p className="mt-2 text-center text-xs text-muted">
            {format ? `Format sélectionné : ${format.label}` : "Choisis d'abord une qualité ci-dessus."}
          </p>
        </motion.div>
      )}

      {error && (
        <motion.p
          key="error"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
          role="alert"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}
