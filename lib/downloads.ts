import fs from 'node:fs'
import path from 'node:path'

/**
 * Les applications de l'équipe, proposées en pied de page.
 *
 * Deux problèmes que le pied de page ne devrait pas avoir à connaître :
 *
 * — Un lien mort est pire que pas de lien. L'installateur Windows pèse une
 *   centaine de mégaoctets : il ne peut pas vivre dans le dépôt (au-delà de
 *   100 Mo, GitHub refuse le push) et n'arrive donc pas tout seul sur le
 *   serveur. On regarde si le fichier est là avant d'en parler ; sinon la
 *   ligne disparaît, plutôt que d'envoyer quelqu'un sur un 404.
 *
 * — Personne ne devrait lancer 100 Mo sans le savoir. La taille est lue sur le
 *   fichier lui-même, à la construction du site, et affichée à côté du nom :
 *   sur un forfait mobile, l'information change la décision.
 *
 * `NEXT_PUBLIC_CAISSE_URL` prend le dessus quand l'installateur est hébergé
 * ailleurs — un stockage objet, une release GitHub. Le lien vaut alors ce que
 * vaut cette adresse, et la taille n'est pas affichée : on ne l'a pas.
 */

export interface StaffApp {
  href: string
  label: string
  /** « Android · équipe », « Windows · 101 Mo » — la plateforme, puis le poids. */
  note: string
  /** Quelle icône lucide le pied de page dessine. */
  icon: 'store' | 'bike' | 'monitor'
}

/** Le poids du fichier tel qu'il est sur le disque, ou null s'il n'y est pas. */
function sizeOf(publicPath: string): string | null {
  try {
    const bytes = fs.statSync(path.join(process.cwd(), 'public', publicPath)).size
    if (!bytes) return null
    const mo = bytes / 1024 / 1024
    return `${mo >= 100 ? Math.round(mo) : mo.toFixed(1)} Mo`
  } catch {
    // Absent du serveur, ou un hébergement qui ne donne pas accès au disque.
    return null
  }
}

/** Le chemin public de l'installateur de la caisse, servi depuis /public. */
export const CAISSE_FILE = 'downloads/Mr. Burritos Caisse Setup 1.2.0.exe'

/**
 * Ce qui est réellement téléchargeable maintenant, dans l'ordre d'affichage.
 * Une entrée dont le fichier manque n'est pas listée.
 */
export function staffApps(): StaffApp[] {
  const apps: StaffApp[] = []

  const caisseUrl = process.env.NEXT_PUBLIC_CAISSE_URL?.trim()
  const caisseSize = sizeOf(CAISSE_FILE)
  if (caisseUrl || caisseSize) {
    apps.push({
      href: caisseUrl || `/${CAISSE_FILE}`,
      label: 'App Desktop',
      note: `Windows${caisseSize && !caisseUrl ? ` · ${caisseSize}` : ''}`,
      icon: 'monitor',
    })
  }

  return apps
}
