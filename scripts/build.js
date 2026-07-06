import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';
import JavaScriptObfuscator from 'javascript-obfuscator';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const build = path.join(root, 'build');
const releases = path.join(root, 'releases');

// ── 1. Clean & create build dirs ──────────────────────────────────────────
fs.rmSync(build, { recursive: true, force: true });
['', 'modal', 'settings', 'assets'].forEach(d =>
  fs.mkdirSync(path.join(build, d), { recursive: true })
);
fs.mkdirSync(releases, { recursive: true });

// ── 2. Build CSS ───────────────────────────────────────────────────────────
console.log('🎨 Building CSS…');
execSync('npx @tailwindcss/cli -i src/styles.css -o src/assets/styles.css --minify', { cwd: root, stdio: 'inherit' });

// ── 3. Rollup bundle ───────────────────────────────────────────────────────
console.log('📦 Bundling…');
execSync('npx rollup -c --bundleConfigAsCjs', { cwd: root, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' } });

// ── 4. Obfuscate JS ────────────────────────────────────────────────────────
console.log('🔒 Obfuscating…');
const obfuscateOptions = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  rotateStringArray: true,
};

['modal/modal.js', 'settings/options.js'].forEach(file => {
  const filePath = path.join(build, file);
  if (!fs.existsSync(filePath)) return;
  const code = fs.readFileSync(filePath, 'utf8');
  const result = JavaScriptObfuscator.obfuscate(code, obfuscateOptions);
  fs.writeFileSync(filePath, result.getObfuscatedCode());
});

// ── 5. Copy static files ───────────────────────────────────────────────────
console.log('📋 Copying static files…');
fs.copyFileSync(path.join(root, 'manifest.json'), path.join(build, 'manifest.json'));
fs.copyFileSync(path.join(root, 'src/modal/modal.html'), path.join(build, 'modal/modal.html'));
fs.copyFileSync(path.join(root, 'src/settings/options.html'), path.join(build, 'settings/options.html'));

// Copy all assets (styles.css + icons)
const assetsDir = path.join(root, 'src/assets');
fs.readdirSync(assetsDir).forEach(file => {
  fs.copyFileSync(path.join(assetsDir, file), path.join(build, 'assets', file));
});

// ── 6. Create zip release ──────────────────────────────────────────────────
console.log('🗜️  Creating release zip…');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const zipPath = path.join(releases, `jira-task-plus-v${version}.zip`);
const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 9 } });

archive.pipe(output);
archive.directory(build, false);
await new Promise((resolve, reject) => {
  output.on('close', resolve);
  archive.on('error', reject);
  archive.finalize();
});

console.log(`✅ Build complete → releases/jira-task-plus-v${version}.zip`);
