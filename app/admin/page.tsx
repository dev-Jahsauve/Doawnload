"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { EditionMark } from "@/components/BrandSignature";

interface AdminStats {
  source: "upstash" | "memoire";
  totals: { analyzes: number; downloads: number };
  today: { date: string; analyzes: number; downloads: number; uniqueUsers: number };
  uniqueUsersAll: number;
  platforms: Record<string, number>;
  last14Days: { date: string; analyzes: number; downloads: number }[];
}

const STORAGE_KEY = "smartdownload:admin";
const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  facebook: "Facebook",
  tiktok: "TikTok",
};

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [input, setInput] = useState("");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");
  const [disabled, setDisabled] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (pwd: string) => {
    if (!pwd) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/stats", { headers: { "x-admin-password": pwd } });
      if (res.status === 401) {
        setError("Mot de passe incorrect.");
        sessionStorage.removeItem(STORAGE_KEY);
        setPassword("");
        return;
      }
      if (res.status === 503) {
        setDisabled(true);
        setError("Tableau de bord désactivé : la variable ADMIN_PASSWORD n'est pas configurée sur le serveur.");
        return;
      }
      const data = (await res.json()) as { stats: AdminStats };
      setStats(data.stats);
      setPassword(pwd);
      sessionStorage.setItem(STORAGE_KEY, pwd);
    } catch {
      setError("Impossible de joindre le serveur.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) void load(saved);
  }, [load]);

  useEffect(() => {
    if (!password) return;
    const t = setInterval(() => void load(password), 30_000);
    return () => clearInterval(t);
  }, [password, load]);

  const logout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setPassword("");
    setStats(null);
  };

  if (!password || !stats) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-sm flex-col justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-line bg-card p-6 shadow-card"
        >
          <div className="flex items-center gap-2">
            <EditionMark className="h-4 w-4" />
            <h1 className="text-lg font-semibold">Tableau de bord</h1>
          </div>
          <p className="mt-2 text-sm text-muted">Acces reserve a l&apos;administrateur du site.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void load(input);
            }}
            className="mt-5 flex flex-col gap-3"
          >
            <input
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Mot de passe admin"
              aria-label="Mot de passe administrateur"
              className="h-12 w-full rounded-xl border border-line bg-bg px-4 text-[15px] outline-none focus:shadow-card"
              autoComplete="current-password"
            />
            <motion.button
              type="submit"
              disabled={loading || !input}
              whileTap={{ scale: 0.98 }}
              className="h-12 rounded-xl bg-accent font-medium text-[color:var(--accent-ink)] disabled:opacity-50"
            >
              {loading ? "Connexion..." : "Ouvrir le tableau de bord"}
            </motion.button>
          </form>
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
            >
              {error}
            </p>
          )}
        </motion.div>
      </div>
    );
  }

  const maxDay = Math.max(1, ...stats.last14Days.map((d) => Math.max(d.analyzes, d.downloads)));
  const platformEntries = Object.entries(stats.platforms).sort((a, b) => b[1] - a[1]);
  const maxPlatform = Math.max(1, ...platformEntries.map(([, v]) => v));

  const cards = [
    { label: "Liens analysés (total)", value: stats.totals.analyzes },
    { label: "Téléchargements (total)", value: stats.totals.downloads },
    { label: "Visiteurs uniques aujourd'hui", value: stats.today.uniqueUsers },
    { label: "Visiteurs uniques (depuis le début)", value: stats.uniqueUsersAll },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Tableau de bord</h1>
          <p className="mt-1 text-sm text-muted">Usage du site en temps réel — jour du {stats.today.date}</p>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => void load(password)}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:text-ink"
          >
            Actualiser
          </motion.button>
          <button onClick={logout} className="text-sm text-muted hover:text-ink">
            Quitter
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl border border-line bg-card p-4 shadow-card"
          >
            <p className="text-2xl font-semibold text-accent">{card.value.toLocaleString("fr-FR")}</p>
            <p className="mt-1 text-xs text-muted">{card.label}</p>
          </motion.div>
        ))}
      </div>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mt-6 rounded-2xl border border-line bg-card p-5 shadow-card"
      >
        <h2 className="text-sm font-medium">Activité — 14 derniers jours</h2>
        <div className="mt-4 flex h-36 items-end gap-2">
          {stats.last14Days.map((d) => (
            <div
              key={d.date}
              className="flex flex-1 flex-col items-center gap-1"
              title={`${d.date} : ${d.analyzes} analyses, ${d.downloads} téléchargements`}
            >
              <div className="flex h-32 w-full max-w-6 items-end justify-center gap-0.5">
                <div
                  className="w-2 rounded-t bg-accent-soft"
                  style={{ height: `${Math.max(2, (d.analyzes / maxDay) * 100)}%` }}
                />
                <div
                  className="w-2 rounded-t bg-accent"
                  style={{ height: `${Math.max(2, (d.downloads / maxDay) * 100)}%` }}
                />
              </div>
              <span className="text-[9px] text-muted">{d.date.slice(8)}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-4 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded bg-accent-soft" /> analyses
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded bg-accent" /> telechargements
          </span>
        </p>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-6 rounded-2xl border border-line bg-card p-5 shadow-card"
      >
        <h2 className="text-sm font-medium">Téléchargements par plateforme</h2>
        <div className="mt-4 flex flex-col gap-3">
          {platformEntries.length === 0 && (
            <p className="text-sm text-muted">Aucun téléchargement enregistré pour le moment.</p>
          )}
          {platformEntries.map(([platform, count]) => (
            <div key={platform} className="flex items-center gap-3">
              <span className="w-24 text-sm text-muted">{PLATFORM_LABELS[platform] ?? platform}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-accent-soft">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(count / maxPlatform) * 100}%` }} />
              </div>
              <span className="w-10 text-right text-sm font-medium">{count}</span>
            </div>
          ))}
        </div>
      </motion.section>

      {stats.source === "memoire" && (
        <p className="mt-6 rounded-xl border border-line bg-card px-4 py-3 text-xs leading-relaxed text-muted">
          Compteurs conservés uniquement en mémoire (perdus au redeploiement, non partages entre instances).
          Pour des statistiques fiables en production, ajoute les variables Upstash
          (<code>UPSTASH_REDIS_REST_URL</code> + <code>UPSTASH_REDIS_REST_TOKEN</code>) dans Vercel.
        </p>
      )}
    </div>
  );
}
