import crypto from 'node:crypto';

// GHL OAuth endpoints (LeadConnector / HighLevel marketplace).
// chooselocation prompts the user to pick which sub-account to grant
// access to, which is what we want for a per-project connection.
export const GHL_AUTHORIZE_URL = 'https://marketplace.gohighlevel.com/oauth/chooselocation';
export const GHL_TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/token';

// Scopes requested for the integration. Mirrored in setup docs.
// Read tags + custom fields for the mapping UI dropdowns; write
// contacts for the upsert during lead delivery.
export const GHL_SCOPES = [
  'contacts.readonly',
  'contacts.write',
  'locations/tags.readonly',
  'locations/customFields.readonly',
  'locations.readonly',
].join(' ');

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function stateSecret(): string {
  // Reuse the service-role key as our HMAC secret. It's already
  // server-only and rotating it is a known-cost operation. Avoids
  // adding yet another env var.
  return requireEnv('SUPABASE_SERVICE_ROLE_KEY');
}

export interface OAuthState {
  provider: 'ghl';
  projectId: string;
  /** Absolute path to redirect the user back to after the handshake. */
  returnTo: string;
  /** Random nonce; defends against state replay. */
  nonce: string;
  /** ms timestamp when this state was issued. Callbacks older than ~10min rejected. */
  issuedAt: number;
}

const STATE_MAX_AGE_MS = 10 * 60 * 1000;

export function encodeState(input: Omit<OAuthState, 'nonce' | 'issuedAt'>): string {
  const payload: OAuthState = {
    ...input,
    nonce: crypto.randomBytes(16).toString('hex'),
    issuedAt: Date.now(),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', stateSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function decodeState(state: string): OAuthState | null {
  const [body, sig] = state.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', stateSecret()).update(body).digest('base64url');
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as OAuthState;
    if (Date.now() - payload.issuedAt > STATE_MAX_AGE_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: requireEnv('GHL_CLIENT_ID'),
    redirect_uri: redirectUri,
    scope: GHL_SCOPES,
    state,
  });
  return `${GHL_AUTHORIZE_URL}?${params.toString()}`;
}

export interface GhlTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  userType: string;
  locationId: string;
  companyId?: string;
  approvedLocations?: string[];
  userId?: string;
  planId?: string;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<GhlTokenResponse> {
  return tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
}

export async function refreshAccessToken(refreshToken: string): Promise<GhlTokenResponse> {
  return tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
}

async function tokenRequest(extra: Record<string, string>): Promise<GhlTokenResponse> {
  const body = new URLSearchParams({
    client_id: requireEnv('GHL_CLIENT_ID'),
    client_secret: requireEnv('GHL_CLIENT_SECRET'),
    user_type: 'Location',
    ...extra,
  });
  const res = await fetch(GHL_TOKEN_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GHL token request failed: ${res.status} ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as GhlTokenResponse;
}

/** Compute the absolute redirect URI for this deployment. */
export function callbackUrl(request: Request): string {
  const url = new URL(request.url);
  return `${url.origin}/api/oauth/callback`;
}
