'use client'

import Image, { type ImageLoaderProps, type ImageProps } from 'next/image'

const CLOUDINARY_UPLOAD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/

/**
 * Cloudinary resizes and encodes the photo itself, from the stored original,
 * at exactly the width the browser asked for. Through the default loader the
 * shot was compressed twice — once by Cloudinary, once more by Next at q75 —
 * which is what made the menu look soft. `c_limit` never enlarges: a picture
 * smaller than the slot is sent as is, the browser does the rest.
 */
export function cloudinaryLoader({ src, width }: ImageLoaderProps): string {
  const m = CLOUDINARY_UPLOAD.exec(src)
  if (!m) return src
  return `${m[1]}c_limit,w_${width},q_auto:good,f_auto/${m[2]}`
}

export const isCloudinary = (src: unknown): src is string =>
  typeof src === 'string' && CLOUDINARY_UPLOAD.test(src)

/** `next/image`, served straight from Cloudinary when the photo lives there. */
export default function Photo({ alt, ...props }: ImageProps) {
  return <Image alt={alt} {...props} loader={isCloudinary(props.src) ? cloudinaryLoader : undefined} />
}
