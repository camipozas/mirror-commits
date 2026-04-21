import type { ConfigLoader } from '@/src/core/config';
import { type Config, configSchema } from '@/src/lib/schema';

/**
 * {@link ConfigLoader} that parses configuration from an in-memory object.
 *
 * @description Used in remote mode where config is sent via the
 * `X-Config` HTTP header on every request. The raw JSON is decoded
 * by the route handler and passed in at construction time.
 */
export class HeaderConfigLoader implements ConfigLoader {
  private readonly config: Config;

  constructor(raw: unknown) {
    this.config = configSchema.parse(raw);
  }

  async load(): Promise<Config> {
    return this.config;
  }
}
