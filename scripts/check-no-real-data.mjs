import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_TARGET_DIRS = ['src/data', 'public', 'fixtures', 'dist'];
export const DEFAULT_TARGETS = ['src', 'public', 'fixtures', 'dist', 'docs/demo', 'README.md', '.env.example', 'index.html'];
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
export const PUBLIC_BUILD_ONLY_CONTENT_PATTERNS = [
  { label: 'local expert review personal name', pattern: tokenPattern('安', '立') },
  { label: 'local analysis pack personal name', pattern: tokenPattern('細', '江') },
  { label: 'local analysis pack real company term', pattern: tokenPattern('Soft', 'Bank') },
  { label: 'local analysis pack real company term', pattern: tokenPattern('ソフト', 'バンク') },
  { label: 'local analysis pack real company term', pattern: tokenPattern('Pay', 'Pay') },
  { label: 'local analysis pack real company term', pattern: tokenPattern('LINE', 'ヤフー') },
  { label: 'local analysis pack real company term', pattern: tokenPattern('LINE ', 'Yahoo') },
  { label: 'local analysis pack real company term', pattern: tokenPattern('Apple') },
  { label: 'local analysis pack real company term', pattern: tokenPattern('Google') },
  { label: 'local analysis pack real company term', pattern: tokenPattern('NTT ', 'DOCOMO') },
  { label: 'local analysis pack excluded company term', pattern: tokenPattern('Chain', 'alysis') },
  { label: 'local analysis pack excluded record', pattern: tokenPattern('D-', '2022503085') },
  { label: 'local analysis pack term', pattern: tokenPattern('Dターム', 'W候補') },
  { label: 'local analysis pack term', pattern: tokenPattern('日本意匠分類にWを含む画像意匠候補') },
  { label: 'local expert review term', pattern: tokenPattern('日本意匠分類', 'W') },
  { label: 'local expert review term', pattern: tokenPattern('画像共通', 'Dターム') },
  { label: 'local expert review term', pattern: tokenPattern('V系', 'Dターム') },
  { label: 'local expert review term', pattern: tokenPattern('専門家', 'レビュー') },
  { label: 'local analysis pack term', pattern: tokenPattern('strict', 'PrefixW') },
  { label: 'local analysis pack term', pattern: tokenPattern('dTermWIncluded', 'Candidate') },
];
export const FIXTURE_ONLY_CONTENT_PATTERNS = [
  { label: 'external URL in fixture', pattern: /\bhttps?:\/\//i },
  { label: 'data or file URI in fixture', pattern: /\b(?:data|file):/i },
  { label: 'absolute Windows path in fixture', pattern: /[A-Z]:[\\/]/i },
  { label: 'UNC path in fixture', pattern: /\\{2,}/ },
  { label: 'absolute user path in fixture', pattern: /(?:\/Users\/|\/home\/[^/]+\/)/i },
  {
    label: 'secret-like assignment in fixture',
    pattern: /"(?:api[_-]?key|access[_-]?token|password|secret|connection[_-]?string)"\s*:\s*"[^"]+"/i,
  },
  { label: 'private key marker in fixture', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/i },
  { label: 'real-like long numeric identifier in fixture', pattern: /\b\d{7,}\b/ },
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
      if (isFixtureFile(relativePath)) {
        for (const { label, pattern } of FIXTURE_ONLY_CONTENT_PATTERNS) {
          if (pattern.test(text)) {
            matches.push(`${relativePath} (${label})`);
          }
        }
      }
      if (isPublicSurfaceFile(relativePath)) {
        for (const { label, pattern } of PUBLIC_BUILD_ONLY_CONTENT_PATTERNS) {
          if (pattern.test(text)) {
            matches.push(`${relativePath} (${label})`);
          }
        }
      }
    });
  }

  return matches.sort((left, right) => left.localeCompare(right));
}

function shouldSkip(relativePath) {
  return EXCLUDED_FILE_PATTERNS.some((pattern) => pattern.test(relativePath));
}

function isPublicSurfaceFile(relativePath) {
  return (
    relativePath === 'dist' ||
    relativePath.startsWith('dist/') ||
    relativePath === 'docs/demo' ||
    relativePath.startsWith('docs/demo/')
  );
}

function isFixtureFile(relativePath) {
  return relativePath.startsWith('fixtures/');
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

function readTargetDirs(argv) {
  if (!argv.includes('--skip-dist')) return DEFAULT_TARGETS;
  return DEFAULT_TARGETS.filter((target) => target !== 'dist');
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  const rootDir = readRootArg(process.argv);
  const matches = findRealDataMatches({ rootDir, targetDirs: readTargetDirs(process.argv) });
  if (matches.length > 0) {
    console.error('Real-data-like files were found in build-controlled directories:');
    for (const match of matches) console.error(`- ${match}`);
    process.exit(1);
  }
  console.log('OK: no real-data-like files or content found in public-build targets.');
}
