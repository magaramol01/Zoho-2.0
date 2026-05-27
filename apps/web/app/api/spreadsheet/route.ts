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
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const tasksUrl = new URL(`${backendApiBaseUrl}/tasks`);

  tasksUrl.searchParams.set('mine', 'false');
  if (projectId) {
    tasksUrl.searchParams.set('projectId', projectId);
  }

  try {
    const tasksResponse = await fetch(tasksUrl, { cache: 'no-store', headers });
    const tasksPayload = await readJsonSafely<unknown[] & ErrorPayload>(tasksResponse);

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
