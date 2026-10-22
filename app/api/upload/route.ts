import { NextRequest, NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({ cloudinary_url: process.env.CLOUDINARY_URL })

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = `data:${file.type};base64,${buffer.toString('base64')}`

    // Keep the photo whole and sharp: only a phone-camera giant is scaled down.
    // It used to be cropped to an 800px square and compressed on arrival, so
    // the menu could never show it larger than that without blurring it. The
    // site asks Cloudinary for the exact size and format it needs per screen.
    const result = await cloudinary.uploader.upload(base64, {
      folder: 'mr-burritos/products',
      transformation: [{ width: 2400, height: 2400, crop: 'limit', quality: 'auto:best' }],
    })

    return NextResponse.json({ url: result.secure_url })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
