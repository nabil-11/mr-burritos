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

    const result = await cloudinary.uploader.upload(base64, {
      folder: 'mr-burritos/products',
      transformation: [{ width: 800, height: 800, crop: 'fill', quality: 'auto', fetch_format: 'auto' }],
    })

    return NextResponse.json({ url: result.secure_url })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
