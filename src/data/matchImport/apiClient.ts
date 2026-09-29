/** Minimal API-Football (api-sports.io, v3) client for fixtures and lineups. */

const BASE_URL = 'https://v3.football.api-sports.io';
const KEY_STORAGE = 'formasyon.apiFootballKey.v1';

export interface ApiTeam {
  id: number;
  name: string;
}

export interface ApiLineupPlayer {
  id: number | null;
  name: string;
  number: number | null;
  /** G / D / M / F. */
  pos: string | null;
  /** "row:col"; row 1 is the goalkeeper. Missing for some competitions. */
  grid: string | null;
}

export interface ApiLineup {
  team: ApiTeam;
  formation: string | null;
  startXI: { player: ApiLineupPlayer }[];
}

export interface ApiFixture {
  fixture: { id: number; date: string; status: { short: string } };
  league: { id: number; name: string; country: string };
  teams: { home: ApiTeam; away: ApiTeam };
  goals: { home: number | null; away: number | null };
}

/**
 * `blocked`: the browser hid the response. The API sends rejections (bad key) without CORS
 * headers, so while online this almost always means the key was refused.
 */
export type MatchApiErrorKind = 'noKey' | 'auth' | 'limit' | 'plan' | 'network' | 'blocked' | 'api';

export class MatchApiError extends Error {
  constructor(
    readonly kind: MatchApiErrorKind,
    message: string = kind,
  ) {
    super(message);
  }
}

export function loadApiKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function saveApiKey(key: string): void {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key);
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    // Storage unavailable: the key only lives for this session.
  }
}

/** API errors come as `[]` or `{ field: message }`. */
function errorOf(errors: unknown): MatchApiError | null {
  if (!errors || typeof errors !== 'object') return null;
  const entries = Object.entries(errors as Record<string, unknown>);
  if (entries.length === 0) return null;
  const [field, msg] = entries[0];
  const text = String(msg);
  if (field === 'token') return new MatchApiError('auth', text);
  if (field === 'requests' || field === 'rateLimit') return new MatchApiError('limit', text);
  if (field === 'plan') return new MatchApiError('plan', text);
  return new MatchApiError('api', text);
}

async function get<T>(path: string, params: Record<string, string>, key: string): Promise<T[]> {
  if (!key) throw new MatchApiError('noKey');
  const url = `${BASE_URL}${path}?${new URLSearchParams(params).toString()}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { 'x-apisports-key': key } });
  } catch {
    throw new MatchApiError(navigator.onLine ? 'blocked' : 'network');
  }
  if (res.status === 401 || res.status === 403) throw new MatchApiError('auth');
  if (res.status === 429) throw new MatchApiError('limit');
  if (!res.ok) throw new MatchApiError('network', `HTTP ${res.status}`);
  const body = (await res.json()) as { errors?: unknown; response?: T[] };
  const err = errorOf(body.errors);
  if (err) throw err;
  return Array.isArray(body.response) ? body.response : [];
}

function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** All fixtures on a day (`YYYY-MM-DD`, in the user's time zone). One request. */
export function fetchFixtures(date: string, key: string): Promise<ApiFixture[]> {
  return get<ApiFixture>('/fixtures', { date, timezone: localTimeZone() }, key);
}

/** Starting line-ups of both teams (home first). One request. */
export function fetchLineups(fixtureId: number, key: string): Promise<ApiLineup[]> {
  return get<ApiLineup>('/fixtures/lineups', { fixture: String(fixtureId) }, key);
}
