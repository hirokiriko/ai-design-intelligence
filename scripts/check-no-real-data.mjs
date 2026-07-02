import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_TARGET_DIRS = ['src/data', 'public', 'dist'];
export const DEFAULT_TARGETS = ['src', 'public', 'dist', 'README.md', '.env.example', 'index.html'];
const joinToken = (...parts) => parts.join('');
const tokenPattern = (...parts) => new RegExp(joinToken(...parts).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
export const FORBIDDEN_NAME_PATTERNS = [
  'design-records-',
  joinToken('design-records-', 'monthly-preview'),
  joinToken('demo-candidate-', 'expanded'),
  joinToken('JP', 'DAD'),
  joinToken('JP', 'WAD'),
  joinToken('JP', 'DRD'),
  joinToken('JP', 'WRD'),
  joinToken('JP', 'DAC'),
  joinToken('JP', 'WAC'),
  joinToken('JP', 'D_'),
  'JPO_Bulk',
];
export const FORBIDDEN_CONTENT_PATTERNS = [
  { label: joinToken('JP', 'DAD'), pattern: tokenPattern('JP', 'DAD') },
  { label: joinToken('JP', 'WAD'), pattern: tokenPattern('JP', 'WAD') },
  { label: joinToken('JP', 'DRD'), pattern: tokenPattern('JP', 'DRD') },
  { label: joinToken('JP', 'WRD'), pattern: tokenPattern('JP', 'WRD') },
  { label: joinToken('JP', 'DAC'), pattern: tokenPattern('JP', 'DAC') },
  { label: joinToken('JP', 'WAC'), pattern: tokenPattern('JP', 'WAC') },
  { label: joinToken('JP', 'D_'), pattern: tokenPattern('JP', 'D_') },
  { label: 'monthly preview real-data filename', pattern: tokenPattern('design-records-', 'monthly-preview') },
  { label: 'demo candidate expanded filename', pattern: tokenPattern('demo-candidate-', 'expanded') },
  { label: 'local JPO bulk path', pattern: /C:[\\/]+KIRIKO_Data/i },
  { label: 'local JPO bulk path', pattern: /C:[\\/]+KIRIKO_Data[\\/]+JPO_Bulk/i },
  { label: 'real company name', pattern: tokenPattern('PANASONIC INTELLECTUAL ', 'PROPERTY MANAGEMENT') },
  { label: 'real company name', pattern: tokenPattern('Koninklijke ', 'Philips') },
  { label: 'real company name', pattern: tokenPattern('Shark', 'Ninja') },
  { label: 'real company name', pattern: tokenPattern('MIDEA ', 'GROUP') },
  { label: 'real company name', pattern: tokenPattern('LG ', 'ELECTRONICS') },
  { label: 'embedded image data token', pattern: tokenPattern('base', '64') },
  { label: 'real-like registration number', pattern: /"registrationNumber"\s*:\s*"?\d{7,}"?/i },
  { label: 'real-like publication document id', pattern: /"publicationDocumentId"\s*:\s*"?\d{7,}"?/i },
  { label: 'real-like gazette XML path', pattern: /DOCUMENT[\\/]+D_/i },
  { label: 'real-like XML filename', pattern: /\b\d{7,}\.xml\b/i },
  { label: 'real-like image filename', pattern: /\b\d{7,}\.(?:jpe?g|png|gif|tiff?)\b/i },
];
const EXCLUDED_FILE_PATTERNS = [
  /(^|\/)[^/]+\.(test|spec)\.[jt]sx?$/i,
  /(^|\/)__snapshots__(\/|$)/i,
];

export function findRealDataMatches({
  rootDir = process.cwd(),
  targetDirs = DEFAULT_TARGETS,
  forbiddenPatterns = FORBIDDEN_NAME_PATTERNS,
  forbiddenContentPatterns = FORBIDDEN_CONTENT_PATTERNS,
} = {}) {
  const root = path.resolve(rootDir);
  const loweredPatterns = forbiddenPatterns.map((pattern) => pattern.toLowerCase());
  const matches = [];

  for (const targetDir of targetDirs) {
    const absoluteTarget = path.resolve(root, targetDir);
    if (!fs.existsSync(absoluteTarget)) continue;
    walk(absoluteTarget, (entryPath) => {
      const relativePath = path.relative(root, entryPath).replaceAll(path.sep, '/');
      if (shouldSkip(relativePath)) return;
      const comparablePath = relativePath.toLowerCase();
      if (loweredPatterns.some((pattern) => comparablePath.includes(pattern))) {
        matches.push(`${relativePath} (filename)`);
      }

      const stat = fs.statSync(entryPath);
      if (!stat.isFile()) return;
      const content = fs.readFileSync(entryPath);
      if (content.includes(0)) return;
      const text = content.toString('utf8');
      for (const { label, pattern } of forbiddenContentPatterns) {
        if (pattern.test(text)) {
          matches.push(`${relativePath} (${label})`);
        }
      }
    });
  }

  return matches.sort((left, right) => left.localeCompare(right));
}

function shouldSkip(relativePath) {
  return EXCLUDED_FILE_PATTERNS.some((pattern) => pattern.test(relativePath));
}

function walk(currentPath, visit) {
  visit(currentPath);
  const stat = fs.statSync(currentPath);
  if (!stat.isDirectory()) return;

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
  const rootDir = readRootArg(process.argv);
  const matches = findRealDataMatches({ rootDir });
  if (matches.length > 0) {
    console.error('Real-data-like files were found in build-controlled directories:');
    for (const match of matches) console.error(`- ${match}`);
    process.exit(1);
  }
  console.log('OK: no real-data-like files or content found in public-build targets.');
}
