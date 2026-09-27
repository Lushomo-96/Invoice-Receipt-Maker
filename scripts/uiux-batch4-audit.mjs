import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const srcFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(path.join(root, dir), {withFileTypes: true})) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(rel);
    else if (/\.(ts|tsx)$/.test(entry.name)) srcFiles.push(rel);
  }
}
walk('src');
const source = srcFiles.map(read).join('\n');
const checks = [];
const check = (name, condition) => checks.push({name, pass: Boolean(condition)});

check('route skeleton component exists', exists('src/components/PageLoading.tsx'));
check('route loading uses Suspense', read('src/App.tsx').includes('<Suspense fallback='));
check('route announcer is wired', read('src/App.tsx').includes('<RouteAnnouncer />'));
check('skip-to-content link present', read('src/components/Layout.tsx').includes('className="skip-link"'));
check('main content has focus target', read('src/components/Layout.tsx').includes('id="main-content"') && read('src/components/Layout.tsx').includes('tabIndex={-1}'));
check('route changes focus main content', read('src/components/Layout.tsx').includes('mainRef.current?.focus'));
check('online status announced', read('src/components/Layout.tsx').includes('aria-live="polite"'));
check('mobile more menu has menu semantics', read('src/components/Layout.tsx').includes('aria-haspopup="menu"') && read('src/components/Layout.tsx').includes('role="menu"'));
check('quick-create menu has keyboard semantics', read('src/components/FAB.tsx').includes("event.key !== 'Escape'") && read('src/components/FAB.tsx').includes('role="menu"'));
check('confirm dialog traps keyboard focus', read('src/components/ConfirmDialog.tsx').includes('focusableSelector') && read('src/components/ConfirmDialog.tsx').includes("event.key !== 'Tab'"));
check('confirm dialog supports Escape', read('src/components/ConfirmDialog.tsx').includes("event.key === 'Escape'"));
check('confirm dialog restores prior focus', read('src/components/ConfirmDialog.tsx').includes('previousFocusRef.current?.focus'));
check('reduced-motion mode present', read('src/index.css').includes('prefers-reduced-motion'));
check('forced-colors support present', read('src/index.css').includes('forced-colors: active'));
check('small-phone breakpoint present', read('src/index.css').includes('max-width: 374px'));
check('long-content utility retained', read('src/index.css').includes('.break-anywhere'));
check('all table headers declare scope', !/<th\b(?![^>]*\bscope=)[^>]*>/g.test(source));
const clickableRows = [...source.matchAll(/<tr\b[^>]*tabIndex=\{0\}[^>]*role=\"link\"/g)].length;
check('clickable desktop rows have keyboard handlers', clickableRows >= 6 && (source.match(/onKeyDown=\{\(event\)/g) ?? []).length >= clickableRows);
check('no browser alert/confirm/prompt', !/window\.(alert|confirm|prompt)|\b(alert|confirm|prompt)\s*\(/.test(source));
check('no as-any casts', !/\bas\s+any\b/.test(source));
check('Business Setup fields have explicit accessible names', read('src/pages/BusinessSetup/index.tsx').includes('aria-label="Business name"') && read('src/pages/BusinessSetup/index.tsx').includes('aria-label="Default currency"'));
check('invoice editor line fields have accessible names', read('src/pages/Invoices/InvoiceForm.tsx').includes('aria-label={`Quantity for'));
check('quotation editor line fields have accessible names', read('src/pages/Quotations/QuotationForm.tsx').includes('aria-label={`Unit price for'));
check('settings sections expose tab semantics', read('src/pages/Settings/index.tsx').includes('role="tablist"') && read('src/pages/Settings/index.tsx').includes('aria-selected='));
check('search inputs expose accessible names', ['Documents/index.tsx','Customers/index.tsx','Receipts/index.tsx','Quotations/index.tsx'].every((file) => read(`src/pages/${file}`).includes('aria-label="Search')));

const expectedProtected = {
  'src/store/useStore.ts': 'f89dfca2a68b033ea9905e838de16fa5a3bdd4e88e98031ca346e0697c37099e',
  'src/utils/helpers.ts': '6ed77a645bbf5cf2c70fd7ed2a3e516178fc9d26c5ed0c80eebd4cf6957a2c2d',
  'src/utils/backup.ts': 'bbd927c12eb93bc280d1fd84da85c4fdc5b4275f75f93cf4107be09607b5215a',
  'src/utils/documentPdf.ts': 'ace2a68f2391b04be6a7d896cd377b6e4d5f8eeb2eca07d442f19336b87cfad8',
  'src/utils/reports.ts': '556e1505abde8d63e041fedae37e714a6eea7aab562480c9f700d01919b4c21b',
  'src/utils/dashboard.ts': '153d03debd1dcee49f2487eb2b616e62567adb46e5d18a5a8585b71f0a62c973',
  'src/utils/settings.ts': '0f3cbc74e3fec49c4ac67cfcb738ac0500e446c29bae2f703aa8224a9ef608db',
  'src/types.ts': '7d69b769028b7f320422d6f4b96cf20fcee8868dba96b5c1dfaa687c0af6f671',
};
for (const [file, expected] of Object.entries(expectedProtected)) check(`protected module unchanged: ${file}`, sha(file) === expected);

const passed = checks.filter((item) => item.pass).length;
for (const item of checks) console.log(`${item.pass ? 'PASS' : 'FAIL'}  ${item.name}`);
console.log(`\n${passed}/${checks.length} UI/UX Batch 4 checks passed.`);
if (passed !== checks.length) process.exit(1);
