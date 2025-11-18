type RequestOpts = {
  signal?: AbortSignal;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  headers?: Record<string, string>;
  method?: string;
  body?: any;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function httpRequest(url: string, opts: RequestOpts = {}) {
  const { signal, timeoutMs = 15000, retries = 0, retryDelayMs = 500, headers = {}, method = 'GET', body } = opts;
  let attempt = 0;
  let lastError: any = null;
  while (attempt <= retries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers,
        body,
        signal: signal || controller.signal,
      } as any);
      clearTimeout(timer);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err = new Error(text || `${method} ${url} failed (${res.status})`);
        (err as any).status = res.status;
        (err as any).responseText = text;
        console.error('[http]', { url, method, status: res.status, text });
        if (attempt < retries && res.status >= 500) {
          attempt += 1;
          await sleep(retryDelayMs);
          continue;
        }
        throw err;
      }
      return res;
    } catch (e: any) {
      clearTimeout(timer);
      lastError = e;
      const isAbort = e?.name === 'AbortError';
      console.error('[http-error]', { url, method, message: e?.message || String(e), abort: isAbort });
      if (attempt < retries && !isAbort) {
        attempt += 1;
        await sleep(retryDelayMs);
        continue;
      }
      throw e;
    }
  }
  throw lastError || new Error('Request failed');
}

export async function httpGetJson<T = any>(url: string, opts: RequestOpts = {}): Promise<T> {
  const res = await httpRequest(url, { ...opts, method: 'GET' });
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error('Failed to parse JSON');
  }
}

export async function httpPostJson<T = any>(url: string, body: any, opts: RequestOpts = {}): Promise<T> {
  const res = await httpRequest(url, {
    ...opts,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    body: JSON.stringify(body),
  });
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error('Failed to parse JSON');
  }
}