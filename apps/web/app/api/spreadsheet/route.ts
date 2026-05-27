import { NextResponse } from 'next/server';

const backendApiBaseUrl =
  process.env.ZOHO_POWER_GRID_API_URL ?? 'http://127.0.0.1:3001/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [metadataResponse, tasksResponse] = await Promise.all([
      fetch(`${backendApiBaseUrl}/metadata`, { cache: 'no-store' }),
      fetch(`${backendApiBaseUrl}/tasks?mine=false`, { cache: 'no-store' }),
    ]);

    if (!metadataResponse.ok) {
      return NextResponse.json(
        { message: `Metadata request failed with ${metadataResponse.status}` },
        { status: 502 },
      );
    }

    if (!tasksResponse.ok) {
      return NextResponse.json(
        { message: `Tasks request failed with ${tasksResponse.status}` },
        { status: 502 },
      );
    }

    const metadata = (await metadataResponse.json()) as {
      projects?: Array<{ id: string; name: string }>;
    };
    const tasks = (await tasksResponse.json()) as unknown[];

    return NextResponse.json({
      projects: metadata.projects ?? [],
      tasks,
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
