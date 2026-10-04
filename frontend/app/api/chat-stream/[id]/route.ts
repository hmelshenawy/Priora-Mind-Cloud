export const dynamic = 'force-dynamic';

function backendBaseUrl() {
  return (process.env.NEST_INTERNAL_API_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}

export async function POST(request: Request, {params}: {params: Promise<{id: string}>}) {
  console.log('🔥 STREAM ROUTE HIT');

  const {id} = await params;
  const authorization = request.headers.get('authorization');
  const body = await request.text();

  const upstream = await fetch(`${backendBaseUrl()}/api/v1/conversations/${encodeURIComponent(id)}/messages`, {
    method: 'POST',
    headers: {
      ...(authorization ? {Authorization: authorization} : {}),
      'Content-Type': request.headers.get('content-type') ?? 'application/json',
    },
    body,
  });

  const headers = new Headers();
  const contentType = upstream.headers.get('content-type');
  const cacheControl = upstream.headers.get('cache-control');

  if (contentType) headers.set('Content-Type', contentType);
  if (cacheControl) headers.set('Cache-Control', cacheControl);

  if (!upstream.body) {
    return new Response(null, {status: upstream.status, headers});
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const {value, done} = await reader.read();

      if (done) {
        controller.close();
        return;
      }

      console.log('NEXT CHUNK:', JSON.stringify(decoder.decode(value, {stream: true})));
      controller.enqueue(value);
    },
    async cancel() {
      await reader.cancel();
    },
  });

  return new Response(stream, {
    status: upstream.status,
    headers,
  });
}
