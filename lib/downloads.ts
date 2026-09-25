import fs from 'node:fs'
import path from 'node:path'

/**
 * Les applications de l'équipe, proposées en pied de page.
 *
 * Trois problèmes que le pied de page ne devrait pas avoir à connaître :
 *
 * — Un lien mort est pire que pas de lien. L'installateur Windows pèse une
 *   centaine de mégaoctets : il ne peut pas vivre dans le dépôt (au-delà de
 *   100 Mo, GitHub refuse le push) et n'arrive donc pas tout seul sur le
 *   serveur. On regarde si le fichier est là avant d'en parler ; sinon la
 *   ligne disparaît, plutôt que d'envoyer quelqu'un sur un 404.
 *
 * — Le nom du fichier change à chaque version — « Mr. Burritos Caisse Setup
 *   1.3.0.exe ». L'écrire en dur voudrait dire modifier le code à chaque
 *   build, et l'oublier une fois suffirait à faire disparaître le lien. On
 *   cherche donc l'installateur dans le dossier, et on garde le plus récent :
 *   déposer le nouveau fichier suffit.
 *
 * — Personne ne devrait lancer 100 Mo sans le savoir. La taille est lue sur le
 *   fichier lui-même et affichée à côté du nom : sur un forfait mobile,
 *   l'information change la décision.
 *
 * `NEXT_PUBLIC_CAISSE_URL` prend le dessus quand l'installateur est hébergé
 * ailleurs — un stockage objet, une release GitHub. Le lien vaut alors ce que
 * vaut cette adresse, et ni taille ni version ne sont affichées : on ne les a
 * pas.
 */

export interface StaffApp {
  href: string
  label: string
  /** « Windows · v1.3.0 · 101 Mo » — la plateforme, la version, puis le poids. */
  note: string
  /** Quelle icône lucide le pied de page dessine. */
  icon: 'store' | 'bike' | 'monitor'
}

/** Le dossier servi publiquement où les installateurs sont déposés. */
export const DOWNLOADS_DIR = 'downloads'

/** Un poids lisible, ou null si le fichier n'est pas là. */
function sizeOf(absolute: string): string | null {
  try {
    const bytes = fs.statSync(absolute).size
    if (!bytes) return null
    const mo = bytes / 1024 / 1024
    return `${mo >= 100 ? Math.round(mo) : mo.toFixed(1)} Mo`
  } catch {
    // Absent du serveur, ou un hébergement qui ne donne pas accès au disque.
    return null
  }
}

/** « …Setup 1.3.0.exe » → [1, 3, 0]. Sans numéro, la version est inconnue. */
function versionOf(file: string): number[] | null {
  const m = file.match(/(\d+)\.(\d+)\.(\d+)/)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

const compare = (a: number[] | null, b: number[] | null): number => {
  if (!a || !b) return 0
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

export interface Installer {
  /** Le nom du fichier, tel qu'il est sur le disque. */
  file: string
  /** « 1.3.0 », ou null quand le nom n'en porte pas. */
  version: string | null
  size: string | null
}

/**
 * Le dernier installateur Windows déposé dans public/downloads.
 *
 * Le plus récent, c'est le plus grand numéro de version — et à défaut de
 * numéro, le fichier le plus récemment écrit. Les deux critères sont là parce
 * qu'un dossier peut contenir l'ancienne version le temps d'une bascule, et
 * que personne ne veut proposer la 1.2 au lendemain de la sortie de la 1.3.
 */
export function latestInstaller(): Installer | null {
  try {
    const dir = path.join(process.cwd(), 'public', DOWNLOADS_DIR)
    const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.exe'))
    if (!files.length) return null

    const best = files
      .map((file) => ({
        file,
        version: versionOf(file),
        mtime: (() => {
          try {
            return fs.statSync(path.join(dir, file)).mtimeMs
          } catch {
            return 0
          }
        })(),
      }))
      .sort((a, b) => compare(b.version, a.version) || b.mtime - a.mtime)[0]

    return {
      file: best.file,
      version: best.version ? best.version.join('.') : null,
      size: sizeOf(path.join(dir, best.file)),
    }
  } catch {
    return null
  }
}

/**
 * Ce qui est réellement téléchargeable maintenant, dans l'ordre d'affichage.
 * Une entrée dont le fichier manque n'est pas listée.
 */
export function staffApps(): StaffApp[] {
  const apps: StaffApp[] = []

  const caisseUrl = process.env.NEXT_PUBLIC_CAISSE_URL?.trim()
  const installer = caisseUrl ? null : latestInstaller()
  if (caisseUrl || installer) {
    const details = installer
      ? [installer.version && `v${installer.version}`, installer.size].filter(Boolean).join(' · ')
      : ''
    apps.push({
      // Le nom contient des espaces et un point : il passe par l'encodage
      // d'URL, sinon le lien casse au premier espace.
      href: caisseUrl || `/${DOWNLOADS_DIR}/${encodeURIComponent(installer!.file)}`,
      label: 'App Desktop',
      note: details ? `Windows · ${details}` : 'Windows',
      icon: 'monitor',
    })
  }

  return apps
}
