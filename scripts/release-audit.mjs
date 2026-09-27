import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fail = [];
const pass = [];
const check = (condition, label) => (condition ? pass : fail).push(label);

const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
const html = read('index.html');
const app = read('src/App.tsx');
const main = read('src/main.tsx');
const store = read('src/store/useStore.ts');
const backup = read('src/utils/backup.ts');

check(pkg.name === 'invoice-receipt-maker', 'production package name');
check(pkg.version === '1.0.0-rc.1', 'release-candidate package version');
check(lock.name === pkg.name && lock.version === pkg.version, 'package-lock identity matches package.json');
check(lock.packages?.['']?.name === pkg.name && lock.packages?.['']?.version === pkg.version, 'package-lock root package matches package.json');
check(html.includes('<title>Invoice & Receipt Maker</title>'), 'production document title');
check(html.includes('manifest.webmanifest'), 'web app manifest linked');
check(fs.existsSync(path.join(root, 'public/manifest.webmanifest')), 'web app manifest exists');
check(main.includes('AppErrorBoundary'), 'top-level error boundary wired');
check(app.includes("import NotFound from './pages/NotFound'"), 'not-found route imported');
check(app.includes('<Route path="*" element={<NotFound />} />'), 'unknown protected routes render a not-found screen');
check(!store.includes('setPaymentMethods:'), 'raw payment-method setter remains removed');
check(store.includes('updatePaymentMethod:'), 'guarded payment-method update API present');
check(store.includes('deletePaymentMethod:'), 'guarded payment-method delete API present');
check(backup.includes("BACKUP_FORMAT = 'invoice-receipt-maker-backup'"), 'versioned backup format retained');
check(backup.includes('validateBackupData'), 'backup validator retained');

const sourceFiles = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) sourceFiles.push(full);
  }
};
walk(path.join(root, 'src'));
let anyCasts = 0;
for (const file of sourceFiles) anyCasts += (fs.readFileSync(file, 'utf8').match(/\bas\s+any\b/g) ?? []).length;
check(anyCasts === 0, 'no `as any` casts in application source');
check(sourceFiles.length >= 37, 'expected application source tree present');
check(!fs.existsSync(path.join(root, 'dist')), 'compiled dist output is not committed in the release source package');

for (const label of pass) console.log(`PASS  ${label}`);
for (const label of fail) console.error(`FAIL  ${label}`);
console.log(`\n${pass.length}/${pass.length + fail.length} release-audit checks passed.`);
if (fail.length) process.exit(1);
