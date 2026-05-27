import { NextResponse } from 'next/server';

const backendApiBaseUrl =
  process.env.ZOHO_POWER_GRID_API_URL ?? 'http://127.0.0.1:3001/api';

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
  const headers = cookie ? { cookie } : undefined;

  try {
    const [metadataResponse, tasksResponse] = await Promise.all([
      fetch(`${backendApiBaseUrl}/metadata`, { cache: 'no-store', headers }),
      fetch(`${backendApiBaseUrl}/tasks?mine=false`, { cache: 'no-store', headers }),
    ]);
    const [metadataPayload, tasksPayload] = await Promise.all([
      readJsonSafely<{ projects?: Array<{ id: string; name: string }> } & ErrorPayload>(
        metadataResponse,
      ),
      readJsonSafely<unknown[] & ErrorPayload>(tasksResponse),
    ]);

    if (!metadataResponse.ok) {
      return NextResponse.json(
        {
          message:
            metadataPayload?.message ??
            `Metadata request failed with ${metadataResponse.status}`,
          details: metadataPayload?.details,
        },
        {
          status:
            metadataResponse.status === 401 || metadataResponse.status === 403
              ? metadataResponse.status
              : 502,
        },
      );
    }

    if (!tasksResponse.ok) {
      return NextResponse.json(
        {
          message:
            tasksPayload?.message ?? `Tasks request failed with ${tasksResponse.status}`,
          details: tasksPayload?.details,
        },
        {
          status:
            tasksResponse.status === 401 || tasksResponse.status === 403
              ? tasksResponse.status
              : 502,
        },
      );
    }

    return NextResponse.json({
      projects: metadataPayload?.projects ?? [],
      tasks: Array.isArray(tasksPayload) ? tasksPayload : [],
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
