import 'server-only';
import type { VercelVerificationRecord } from './types';

/**
 * Thin wrapper over the Vercel REST API for managing project domains.
 *
 * Required env vars (set in Vercel dashboard for Preview + Production scopes):
 *   - VERCEL_TOKEN       Personal access token (https://vercel.com/account/tokens)
 *   - VERCEL_PROJECT_ID  The convertiq-studio Vercel project ID
 *   - VERCEL_TEAM_ID     Optional, if the project is team-scoped
 *
 * When VERCEL_TOKEN is unset, every method returns mocked data so local dev
 * works without polluting the real Vercel project with test domains.
 */

const TOKEN = process.env.VERCEL_TOKEN;
const PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const TEAM_ID = process.env.VERCEL_TEAM_ID;
const API_BASE = 'https://api.vercel.com';

export const isMocked = !TOKEN || !PROJECT_ID;

if (isMocked && typeof process !== 'undefined' && process.env.NEXT_PUBLIC_VERCEL_ENV) {
  // Surface in Vercel logs why domains come back instantly verified.
  console.warn(
    `[vercel.ts] Running in MOCK mode. VERCEL_TOKEN=${TOKEN ? 'set' : 'missing'}, VERCEL_PROJECT_ID=${PROJECT_ID ? 'set' : 'missing'}.`,
  );
}

export type AddDomainResult = {
  verified: boolean;
  verification: VercelVerificationRecord[];
  misconfigured?: boolean;
};

export type DomainStatusResult = {
  verified: boolean;
  verification: VercelVerificationRecord[];
  misconfigured?: boolean;
};

function teamQuery(): string {
  return TEAM_ID ? `?teamId=${encodeURIComponent(TEAM_ID)}` : '';
}

function teamQueryAnd(extra: string): string {
  return TEAM_ID ? `?teamId=${encodeURIComponent(TEAM_ID)}&${extra}` : `?${extra}`;
}

async function vercelFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });
}

/** Attach a domain to the Vercel project AND fetch its DNS-config state. */
export async function addDomain(domain: string): Promise<AddDomainResult> {
  if (isMocked) {
    return { verified: true, verification: [], misconfigured: false };
  }
  const res = await vercelFetch(`/v10/projects/${PROJECT_ID}/domains${teamQuery()}`, {
    method: 'POST',
    body: JSON.stringify({ name: domain }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Vercel ${res.status}: failed to add domain`);
  }
  const attach = await res.json();

  // Vercel returns `verified: true` for subdomains of domains the user already owns
  // (ownership auto-passes), but that doesn't mean DNS is set up. The actual DNS state
  // lives on /v6/domains/{domain}/config.
  const cfgRes = await vercelFetch(
    `/v6/domains/${encodeURIComponent(domain)}/config${teamQueryAnd(`projectId=${PROJECT_ID}`)}`,
  );
  const cfg = cfgRes.ok ? await cfgRes.json() : {};

  return {
    verified: attach.verified ?? false,
    verification: attach.verification ?? [],
    misconfigured: cfg.misconfigured ?? false,
  };
}

/** Re-poll Vercel for the domain's current status. */
export async function getDomainStatus(domain: string): Promise<DomainStatusResult> {
  if (isMocked) {
    return { verified: true, verification: [] };
  }
  const res = await vercelFetch(
    `/v9/projects/${PROJECT_ID}/domains/${encodeURIComponent(domain)}${teamQuery()}`,
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Vercel ${res.status}: failed to get domain`);
  }
  const data = await res.json();
  // Also pull DNS config to surface misconfigured state cleanly.
  const cfgRes = await vercelFetch(
    `/v6/domains/${encodeURIComponent(domain)}/config${teamQueryAnd(`projectId=${PROJECT_ID}`)}`,
  );
  const cfg = cfgRes.ok ? await cfgRes.json() : { misconfigured: undefined };
  return {
    verified: data.verified ?? false,
    verification: data.verification ?? [],
    misconfigured: cfg.misconfigured,
  };
}

/** Remove a domain from the Vercel project. */
export async function removeDomain(domain: string): Promise<void> {
  if (isMocked) return;
  const res = await vercelFetch(
    `/v9/projects/${PROJECT_ID}/domains/${encodeURIComponent(domain)}${teamQuery()}`,
    { method: 'DELETE' },
  );
  if (!res.ok && res.status !== 404) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Vercel ${res.status}: failed to remove domain`);
  }
}
