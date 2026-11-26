import Link from "next/link";
import { BrandSignature } from "./BrandSignature";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-6 py-8 text-center">
        <p className="text-xs leading-relaxed text-muted">
          L&apos;utilisateur est responsable du respect des droits d&apos;auteur du contenu téléchargé.
          SmartDownload n&apos;héberge aucun fichier.
        </p>
        <nav className="flex items-center gap-4 text-sm text-muted">
          <Link href="/" className="hover:text-ink">Accueil</Link>
          <span aria-hidden>/</span>
          <Link href="/historique" className="hover:text-ink">Historique</Link>
        </nav>
        <p className="text-xs text-muted">© {new Date().getFullYear()} SmartDownload</p>
        <BrandSignature />
      </div>
    </footer>
  );
}
