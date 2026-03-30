import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
}

const ALLOWED_DIRS = ['hall-of-fame', 'season-photos', 'season-docs']

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const segments = await params
  const pathParts = segments.path

  // Expect exactly 2 segments: [subdir, filename]
  if (pathParts.length !== 2) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const [subdir, rawFilename] = pathParts

  if (!ALLOWED_DIRS.includes(subdir)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Sanitize filename to prevent directory traversal
  const filename = path.basename(rawFilename)
  const filePath = path.join(process.cwd(), 'uploads', subdir, filename)

  try {
    const data = await readFile(filePath)
    const ext = filename.split('.').pop()?.toLowerCase() || ''
    const contentType = CONTENT_TYPES[ext] || 'application/octet-stream'

    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
