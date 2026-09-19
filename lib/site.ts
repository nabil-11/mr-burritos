/**
 * The restaurant's public details, in one place. The home page, the footer,
 * the order tracker and the search-engine card all read them from here, so a
 * new phone number is changed once.
 */
export const SITE = {
  name: 'Mr. Burritos',
  tagline: 'Crunch makes everything better',
  phone: '+216 93822570',
  email: 'mr.burritos.nasr@gmail.com',
  /** Google plus code, as printed on the shop sign. */
  location: 'V557+F6R, Ariana',
  city: 'Ariana',
  region: 'Tunis',
  country: 'TN',
  lat: 36.8588769779779,
  lng: 10.16311086959374,
}

/** Digits only, as wa.me wants them; empty when no WhatsApp line is configured. */
export const WHATSAPP_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '').replace(/\D/g, '')

export const whatsappLink = (text: string) =>
  WHATSAPP_NUMBER ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}` : ''
