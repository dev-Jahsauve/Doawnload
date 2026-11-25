/**
 * Signature de marque — discrete par conception.
 * Un mini pictogramme or (cercle + fleche, rappel du logo Eddition Smartebooks)
 * et la mention en tres petites capitales. A ne jamais agrandir.
 */
export function EditionMark({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={`mark ${className}`} aria-hidden>
      <circle cx="12" cy="12" r="9.5" strokeWidth="1.8" />
      <path d="M12 8v6" strokeWidth="2.2" />
      <path d="m9.4 11.8 2.6 2.6 2.6-2.6" strokeWidth="2.2" />
    </svg>
  );
}

export function BrandSignature({ className = "" }: { className?: string }) {
  return (
    <span className={`brand-signature inline-flex items-center gap-1.5 ${className}`}>
      <EditionMark />
      Eddition Smartebooks
    </span>
  );
}
