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
    'VERCEL_OIDC_TOKEN',
    'x-vercel-oidc-token',
    'x-vercel-trusted-oidc-idp-token',
    '/v1/trial/design-export',
  ])('rejects the server-only marker %s in dist', (marker) => {
    withTemporaryBundle(marker, (root) => {
      let failure: unknown;
      try {
        runSafetyCheck(root);
      } catch (error) {
        failure = error;
      }
      assertScannerRejected(failure);
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
    [
      'VERCEL_OIDC_TOKEN',
      'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJGSVhUVVJFLUNMSUVOVC1CVU5ETEUiLCJleHAiOjQxMDI0NDQ4MDB9.RklYVFVSRS1TSUdOQVRVUkU',
      'configured server-only Vercel OIDC token value',
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

describe('subprocess rejection diagnostics', () => {
  it('accepts a scanner rejection diagnostic', () => {
    const error = Object.assign(new Error('FIXTURE-SCANNER-REJECTED'), {
      stderr: 'Server-only Backend configuration was found in the client bundle:\n- dist/app.js (server-only marker)\n',
    });
    expect(() => assertScannerRejected(error)).not.toThrow();
  });

  it('rejects a simulated EPERM spawn failure without running a child', () => {
    const error = Object.assign(new Error('spawnSync FIXTURE-NODE EPERM'), {
      code: 'EPERM', stdout: '', stderr: '',
    });
    expect(() => assertScannerRejected(error)).toThrow();
  });

  it('rejects unrelated child-process stderr', () => {
    const error = Object.assign(new Error('FIXTURE-CHILD-FAILED'), {
      stderr: 'FIXTURE-UNRELATED-RUNTIME-ERROR',
    });
    expect(() => assertScannerRejected(error)).toThrow();
  });

  it('rejects absence of a scanner failure', () => {
    expect(() => assertScannerRejected(undefined)).toThrow();
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
      VERCEL_OIDC_TOKEN: '',
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

function assertScannerRejected(error: unknown): void {
  expect(commandOutput(error)).toContain('Server-only Backend configuration was found in the client bundle:');
}
