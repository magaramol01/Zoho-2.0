import { NextResponse } from "next/server"

const backendApiBaseUrl =
  process.env.ZOHO_POWER_GRID_API_URL ?? "http://127.0.0.1:3001/api"

type ErrorPayload = {
  message?: string
  details?: string
}

const readJsonSafely = async <T>(response: Response) => {
  const raw = await response.text()

  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const cookie = request.headers.get("cookie")
  const { searchParams } = new URL(request.url)
  const analyticsUrl = new URL(`${backendApiBaseUrl}/timesheet/analytics`)

  for (const [key, value] of searchParams.entries()) {
    analyticsUrl.searchParams.set(key, value)
  }

  try {
    const response = await fetch(analyticsUrl, {
      cache: "no-store",
      headers: cookie ? { cookie } : undefined,
    })
    const payload = await readJsonSafely<Record<string, unknown> & ErrorPayload>(
      response
    )

    if (!response.ok) {
      return NextResponse.json(
        {
          message:
            payload?.message ??
            `Analytics request failed with ${response.status}`,
          details: payload?.details,
        },
        {
          status:
            response.status === 401 || response.status === 403
              ? response.status
              : 502,
        }
      )
    }

    return NextResponse.json(payload ?? {})
  } catch (error) {
    return NextResponse.json(
      {
        message: "Unable to reach the backend API.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 }
    )
  }
}
