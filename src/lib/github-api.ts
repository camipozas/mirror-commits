/**
 * HTTP client for the GitHub REST API.
 *
 * @description Wraps `fetch` with authentication, base URL handling,
 * error reporting, and pagination support. Each instance is bound to
 * a single Personal Access Token, so the caller constructs one client
 * per identity (work / personal).
 */
export class GitHubClient {
  private static readonly BASE = 'https://api.github.com';
  private readonly token: string;

  constructor(token: string) {
    this.token = token;
  }

  /**
   * Perform an authenticated fetch against the GitHub REST API.
   *
   * @param path - API path (e.g. `/repos/owner/repo`).
   * @param options - Optional method, body, and extra headers.
   * @returns The parsed JSON response body.
   * @throws If the response status is not 2xx.
   */
  async fetch<T = unknown>(
    path: string,
    options?: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
    }
  ): Promise<T> {
    const url = path.startsWith('http') ? path : `${GitHubClient.BASE}${path}`;
    const res = await fetch(url, {
      method: options?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
        ...options?.headers,
      },
      ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `GitHub API ${res.status}: ${options?.method ?? 'GET'} ${path} — ${text}`
      );
    }

    if (res.status === 204) {
      return undefined as T;
    }
    return res.json() as Promise<T>;
  }

  /**
   * Fetch all pages of a paginated GitHub endpoint.
   *
   * @param path - API path with query params.
   * @returns Concatenated array of items from all pages.
   */
  async fetchPaginated<T = unknown>(path: string): Promise<T[]> {
    const items: T[] = [];
    let url: string | null = path.startsWith('http')
      ? path
      : `${GitHubClient.BASE}${path}`;

    while (url) {
      const res: Response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`GitHub API ${res.status}: GET ${url} — ${text}`);
      }

      const page = (await res.json()) as T[];
      items.push(...page);

      // Follow Link: <url>; rel="next"
      const link = res.headers.get('link');
      const next = link?.match(/<([^>]+)>;\s*rel="next"/);
      url = next?.[1] ?? null;
    }

    return items;
  }
}
