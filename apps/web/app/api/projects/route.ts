import { NextResponse } from 'next/server';

const backendApiBaseUrl =
  process.env.ZOHO_POWER_GRID_API_URL ?? 'http://127.0.0.1:6002/api';

type ErrorPayload = {
  message?: string;
  details?: string;
};

const readJsonSafely = async <T>(response: Response) => {
  const raw = await response.text();

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const cookie = request.headers.get('cookie');

  try {
    const response = await fetch(`${backendApiBaseUrl}/metadata`, {
      cache: 'no-store',
      headers: cookie ? { cookie } : undefined,
    });
    const payload = await readJsonSafely<
      {
        projects?: Array<{ id: string; name: string }>;
      } & ErrorPayload
    >(response);

    if (!response.ok) {
      return NextResponse.json(
        {
          message: payload?.message ?? `Projects request failed with ${response.status}`,
          details: payload?.details,
        },
        { status: response.status === 401 || response.status === 403 ? response.status : 502 },
      );
    }

    return NextResponse.json({
      projects: payload?.projects ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: 'Unable to reach the backend API.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 502 },
    );
  }
}
