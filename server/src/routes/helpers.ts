import { getProvider } from "../services/provider.js";
import { parseAndValidateUrl } from "../lib/urls.js";

/** Revalide l'URL côté serveur puis délègue au fournisseur d'extraction. */
export async function analyze(rawUrl: string) {
  const url = parseAndValidateUrl(rawUrl);
  return getProvider().analyze(url.toString());
}
