const KEY = "smartdownload:history";
const LIMIT = 20;

export interface HistoryEntry {
  id: string;
  title: string;
  format: string;
  thumbnail: string;
  url: string;
  at: number;
}

export function addHistory(entry: Omit<HistoryEntry, "id" | "at">): HistoryEntry {
  const full: HistoryEntry = { ...entry, id: crypto.randomUUID(), at: Date.now() };
  try {
    const list = [full, ...readHistory()].slice(0, LIMIT);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // stockage indisponible : on ignore
  }
  return full;
}

export function readHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(list) ? list.slice(0, LIMIT) : [];
  } catch {
    return [];
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // rien a faire
  }
}
