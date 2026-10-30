// Validate the file and fragment references most likely to break during a restructure.
import { readdir, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = [];
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(full);
    else if (/\.(html|css|js|svg)$/.test(entry.name)) files.push(full);
  }
}
await collect(root);
const issues = [];
let references = 0;
for (const file of files) {
  const source = await readFile(file, 'utf8');
  const label = path.relative(root, file);
  if (file.endsWith('.html')) {
    if ((source.match(/<h1(?:\s|>)/g) || []).length !== 1) issues.push(`${label}: expected one h1`);
    if (!source.includes('id="main-content"')) issues.push(`${label}: missing skip-link destination`);
    const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    if (ids.length !== new Set(ids).size) issues.push(`${label}: duplicate IDs`);
  }
  const matches = file.endsWith('.css')
    ? [...source.matchAll(/url\(["']?([^"')]+)["']?\)/g)]
    : [...source.matchAll(/(?:href|src)=["']([^"']+)["']/g)];
  for (const [, reference] of matches) {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference) || reference.includes('${')) continue;
    const [resource, fragment] = reference.split('#');
    const base = file.endsWith('.js') ? root : path.dirname(file);
    const target = resource ? path.resolve(base, resource.split('?')[0]) : file;
    references++;
    try {
      if (!(await stat(target)).isFile()) throw new Error('not a file');
      if (fragment) {
        const targetSource = await readFile(target, 'utf8');
        if (!targetSource.includes(`id="${fragment}"`)) issues.push(`${label}: missing anchor ${reference}`);
      }
    } catch { issues.push(`${label}: missing resource ${reference}`); }
  }
  if (file.endsWith('.js')) {
    const syntax = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (syntax.status !== 0) issues.push(`${label}: ${syntax.stderr}`);
  }
}
if (issues.length) { console.error(issues.join('\n')); process.exitCode = 1; }
else console.log(`PASS: ${files.length} site files, ${references} local references, page structure and browser JavaScript syntax.`);
