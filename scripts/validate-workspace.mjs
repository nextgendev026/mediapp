import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const requiredFiles = [
  'package.json',
  'pnpm-workspace.yaml',
  'turbo.json',
  'tsconfig.json',
  'eslint.config.mjs',
  '.gitignore',
  '.env.example',
  'README.md'
];
const requiredPackages = ['types', 'fhir-models', 'sdk', 'config', 'ui'];
const missingFiles = requiredFiles.filter((file) => !existsSync(resolve(root, file)));
const missingPackages = requiredPackages.filter((packageName) => !existsSync(resolve(root, 'packages', packageName, 'package.json')));

if (missingFiles.length > 0 || missingPackages.length > 0) {
  if (missingFiles.length > 0) {
    console.error(`Missing foundation files: ${missingFiles.join(', ')}`);
  }
  if (missingPackages.length > 0) {
    console.error(`Missing shared packages: ${missingPackages.join(', ')}`);
  }
  process.exitCode = 1;
} else {
  const tokenSource = readFileSync(resolve(root, 'packages', 'ui', 'src', 'tokens.css'), 'utf8');
  const requiredTokens = [
    '--color-primary: #1DA84A',
    '--color-primary-dark: #168A3C',
    '--color-primary-light: #E8F7ED',
    '--color-secondary: #0066CC',
    '--color-accent: #FF6B35',
    '--touch-target-min: 44px'
  ];
  const missingTokens = requiredTokens.filter((token) => !tokenSource.includes(token));
  if (missingTokens.length > 0) {
    console.error(`Missing design tokens: ${missingTokens.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(`Workspace validation passed: ${requiredPackages.length} shared packages.`);
  }
}
