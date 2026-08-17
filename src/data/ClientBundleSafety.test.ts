import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();
const safetyScript = path.resolve(repositoryRoot, 'scripts', 'check-client-bundle-safety.mjs');

describe('client bundle server-only configuration safety', () => {
  it('accepts a bundle containing only the public same-origin API path', () => {
    withTemporaryBundle(
      'const endpoint="/api/trial/design-export";',
      (root) => {
        expect(() => runSafetyCheck(root)).not.toThrow();
      },
    );
  });

  it.each([
    'KIRIKO_TRIAL_BACKEND_BASE_URL',
    'KIRIKO_TRIAL_BACKEND_BEARER',
    '/v1/trial/design-export',
  ])('rejects the server-only marker %s in dist', (marker) => {
    withTemporaryBundle(marker, (root) => {
      expect(() => runSafetyCheck(root)).toThrow();
    });
  });

  it.each([
    [
      'KIRIKO_TRIAL_BACKEND_BASE_URL',
      'https://fixture-client-bundle-backend.invalid',
      'configured server-only Backend URL value',
    ],
    [
      'KIRIKO_TRIAL_BACKEND_BEARER',
      'FIXTURE-CLIENT-BUNDLE-SECRET-0001',
      'configured server-only Backend Bearer value',
    ],
  ] as const)('rejects configured %s values without printing the value', (name, value, label) => {
    withTemporaryBundle(value, (root) => {
      let output = '';
      try {
        runSafetyCheck(root, { [name]: value });
      } catch (error) {
        output = commandOutput(error);
      }

      expect(output).toContain(label);
      expect(output).not.toContain(value);
    });
  });
});

function withTemporaryBundle(content: string, assertion: (root: string) => void): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'client-bundle-safety-'));
  const dist = path.join(root, 'dist');
  try {
    fs.mkdirSync(dist, { recursive: true });
    fs.writeFileSync(path.join(dist, 'app.js'), content, 'utf8');
    assertion(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function runSafetyCheck(root: string, environment: Record<string, string> = {}): void {
  execFileSync(process.execPath, [safetyScript, '--root', root], {
    encoding: 'utf8',
    env: {
      ...process.env,
      KIRIKO_TRIAL_BACKEND_BASE_URL: '',
      KIRIKO_TRIAL_BACKEND_BEARER: '',
      ...environment,
    },
    stdio: 'pipe',
  });
}

function commandOutput(error: unknown): string {
  if (!(error instanceof Error)) return '';
  const value = error as Error & { stdout?: string | Buffer; stderr?: string | Buffer };
  return `${value.stdout?.toString() ?? ''}${value.stderr?.toString() ?? ''}`;
}
