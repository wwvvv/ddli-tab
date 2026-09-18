// Missing API endpoints use the API envelope, never an HTML page or SPA fallback.
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    { error: { code: 'NOT_FOUND', message: 'API endpoint not found' }, requestId: crypto.randomUUID() },
    { status: 404, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } },
  );
}

export { GET as POST, GET as PUT, GET as PATCH, GET as DELETE, GET as OPTIONS, GET as HEAD };
