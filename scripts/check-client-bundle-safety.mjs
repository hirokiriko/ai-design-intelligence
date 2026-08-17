import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STATIC_MARKERS = [
  {
    label: 'server-only Backend URL environment name',
    value: 'KIRIKO_TRIAL_BACKEND_BASE_URL',
  },
  {
    label: 'server-only Backend Bearer environment name',
    value: 'KIRIKO_TRIAL_BACKEND_BEARER',
  },
  { label: 'private Backend endpoint path', value: '/v1/trial/design-export' },
];

export function findClientBundleSafetyMatches({ rootDir = process.cwd() } = {}) {
  const root = path.resolve(rootDir);
  const dist = path.resolve(root, 'dist');
  if (!fs.existsSync(dist) || !fs.statSync(dist).isDirectory()) {
    return ['dist (missing client build)'];
  }

  const configuredMarkers = [
    {
      label: 'configured server-only Backend URL value',
      value: process.env.KIRIKO_TRIAL_BACKEND_BASE_URL,
    },
    {
      label: 'configured server-only Backend Bearer value',
      value: process.env.KIRIKO_TRIAL_BACKEND_BEARER,
    },
  ].filter((marker) => typeof marker.value === 'string' && marker.value.length >= 8);
  const markers = [...STATIC_MARKERS, ...configuredMarkers];
  const matches = [];

  walk(dist, (entryPath) => {
    if (!fs.statSync(entryPath).isFile()) return;
    const content = fs.readFileSync(entryPath);
    if (content.includes(0)) return;
    const text = content.toString('utf8');
    const relativePath = path.relative(root, entryPath).replaceAll(path.sep, '/');
    for (const marker of markers) {
      if (text.includes(marker.value)) matches.push(`${relativePath} (${marker.label})`);
    }
  });

  return matches.sort((left, right) => left.localeCompare(right));
}

function walk(currentPath, visit) {
  visit(currentPath);
  if (!fs.statSync(currentPath).isDirectory()) return;
  for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
    walk(path.join(currentPath, entry.name), visit);
  }
}

function readRootArg(argv) {
  const rootIndex = argv.indexOf('--root');
  if (rootIndex === -1) return process.cwd();
  return argv[rootIndex + 1] ? path.resolve(argv[rootIndex + 1]) : process.cwd();
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  const matches = findClientBundleSafetyMatches({ rootDir: readRootArg(process.argv) });
  if (matches.length > 0) {
    console.error('Server-only Backend configuration was found in the client bundle:');
    for (const match of matches) console.error(`- ${match}`);
    process.exit(1);
  }
  console.log('OK: client bundle contains no server-only Backend configuration.');
}
