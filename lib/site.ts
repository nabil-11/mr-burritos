/**
 * The restaurant's public details, in one place. The home page, the footer,
 * the order tracker and the search-engine card all read them from here, so a
 * new phone number is changed once.
 */
export const SITE: {
  name: string
  tagline: string
  phone: string
  email: string
  location: string
  address: string
  landmark: string
  neighbourhood: string
  city: string
  region: string
  postalCode: string
  country: string
  lat: number
  lng: number
  social: { instagram: string; facebook: string; tiktok: string }
} = {
  name: 'Mr. Burritos',
  tagline: 'Crunch makes everything better',
  phone: '+216 93822570',
  email: 'mr.burritos.nasr@gmail.com',
  /** Google plus code, as printed on the shop sign. */
  location: 'V557+F6R, Ariana',
  // À VALIDER PAR LE GÉRANT — l'adresse lisible (rue, numéro), pour les clients
  // et pour Google. Vide : le quartier ci-dessous en tient lieu.
  address: '',
  // À VALIDER PAR LE GÉRANT — un repère que tout le monde connaît (« en face
  // de… »), affiché sous l'adresse.
  landmark: 'Ennasr, Ariana',
  /** Le quartier, dans le hero et dans le titre de la page. À VALIDER PAR LE GÉRANT. */
  neighbourhood: 'Ennasr',
  city: 'Ariana',
  /** Le gouvernorat : Ariana en est un à part entière, pas Tunis. */
  region: 'Ariana',
  // À VALIDER PAR LE GÉRANT — code postal d'Ennasr (2037), pour la fiche Google.
  postalCode: '2037',
  country: 'TN',
  lat: 36.8588769779779,
  lng: 10.16311086959374,
  /**
   * Les comptes de la marque. Une icône n'apparaît que pour une adresse
   * renseignée. À VALIDER PAR LE GÉRANT.
   */
  social: {
    instagram: '',
    facebook: '',
    tiktok: '',
  },
}

/** L'adresse telle qu'un client la lit : la rue quand elle est connue, le quartier sinon. */
export const SITE_ADDRESS_LINE = SITE.address || `${SITE.neighbourhood}, ${SITE.city}`

/** The public origin, without a trailing slash — canonical links, sitemap, JSON-LD. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

/** Digits only, as wa.me wants them; empty when no WhatsApp line is configured. */
export const WHATSAPP_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '').replace(/\D/g, '')

export const whatsappLink = (text: string) =>
  WHATSAPP_NUMBER ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}` : ''
