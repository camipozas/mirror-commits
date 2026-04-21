import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let tempDir: string;
let _mockPlistPath: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'mirror-launchd-'));
  _mockPlistPath = join(tempDir, 'test.plist');
});

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true });
  }
  vi.restoreAllMocks();
});

vi.mock('@/src/lib/constants.js', async () => {
  const temp = await import('node:fs/promises').then((fs) =>
    fs.mkdtemp(join(tmpdir(), 'mirror-launchd-const-'))
  );
  const plistPath = join(temp, 'test.plist');
  return {
    LAUNCHD_LABEL: 'com.test.mirror-commits',
    LAUNCHD_PLIST: plistPath,
    LOG_FILE: join(temp, 'mirror.log'),
  };
});

// Mock launchctl since we don't want to actually install
vi.mock('node:child_process', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:child_process')>();
  return {
    ...original,
    execFile: vi.fn((cmd: string, args: string[], ...rest: unknown[]) => {
      const callback = rest.find((r) => typeof r === 'function') as
        | ((
            err: Error | null,
            result: { stdout: string; stderr: string }
          ) => void)
        | undefined;
      if (cmd === 'launchctl' && callback) {
        callback(null, { stdout: 'ok', stderr: '' });
        return {} as ReturnType<typeof original.execFile>;
      }
      return (original.execFile as (...a: unknown[]) => unknown)(
        cmd,
        args,
        ...rest
      );
    }),
  };
});

describe('installSchedule', () => {
  it('generates a valid plist file', async () => {
    const { installSchedule } = await import('@/src/core/launchd.js');
    const { LAUNCHD_PLIST } = await import('@/src/lib/constants.js');

    await installSchedule(22, '/Users/test/mirror-commits');

    const content = await readFile(LAUNCHD_PLIST, 'utf-8');
    expect(content).toContain('com.test.mirror-commits');
    expect(content).toContain('<integer>22</integer>');
    expect(content).toContain('/Users/test/mirror-commits');
    expect(content).toContain('npx tsx src/cli/index.ts sync');
  });
});

describe('scheduleStatus', () => {
  it("returns 'No schedule' when plist doesn't exist", async () => {
    // Remove the mock to ensure clean state
    const { LAUNCHD_PLIST } = await import('@/src/lib/constants.js');
    try {
      const { rm } = await import('node:fs/promises');
      await rm(LAUNCHD_PLIST);
    } catch {
      // Plist may not exist in a fresh test env; ignore.
    }

    const { scheduleStatus } = await import('@/src/core/launchd.js');
    const result = await scheduleStatus();
    expect(result).toContain('No schedule');
  });
});

describe('removeSchedule', () => {
  it('completes without error even when nothing installed', async () => {
    const { removeSchedule } = await import('@/src/core/launchd.js');
    const result = await removeSchedule();
    expect(result).toContain('Removed');
  });
});
