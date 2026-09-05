#!/usr/bin/env bash
# Refresh ./mock from the dao-mock-proposal-states worktree.
# Usage: ./update-mock.sh [path/to/web-client-v2-checkout]
# Requires Node.js and Git. Copies static files only; never commits or pushes.
set -euo pipefail

MOCK_SITE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ $# -gt 1 ]]; then
  echo "Usage: $0 [path/to/web-client-v2-checkout]" >&2
  exit 1
fi

node --input-type=module - "$MOCK_SITE_DIR" "${1:-}" <<'NODE'
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const [siteDir, requestedSource] = process.argv.slice(2);
const targetDir = path.join(siteDir, 'mock');
const git = (directory, ...args) => execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8' }).trim();

function findMockWorktree() {
  const sibling = path.resolve(siteDir, '../web-client-v2');
  const worktrees = git(sibling, 'worktree', 'list', '--porcelain').split('\n\n');
  const entry = worktrees.find((entry) => entry.split('\n').includes('branch refs/heads/dao-mock-proposal-states'));
  if (!entry) throw new Error('No dao-mock-proposal-states worktree found. Pass the source checkout path as an argument.');
  return entry.split('\n').find((line) => line.startsWith('worktree ')).slice('worktree '.length);
}

const sourceDir = requestedSource ? path.resolve(requestedSource) : findMockWorktree();
const required = [
  'mock/index.html', 'mock/proposal-states.js', 'mock/modal-catalog-data.js',
  'mock/validate-current-flow.mjs', 'styles.css', 'LICENSE', 'fonts/LICENSE.txt',
];
for (const file of required) {
  if (!fs.statSync(path.join(sourceDir, file), { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Missing source file: ${path.join(sourceDir, file)}`);
  }
}
// Validate the working copy before touching the website. Regenerate a stale catalog
// in the source checkout with node mock/generate-modal-catalog.mjs, then retry.
execFileSync(process.execPath, [path.join(sourceDir, 'mock/validate-current-flow.mjs')], { stdio: 'inherit' });
const branch = git(sourceDir, 'rev-parse', '--abbrev-ref', 'HEAD');
const commit = git(sourceDir, 'rev-parse', '--short', 'HEAD');
const catalog = {};
new Function('window', fs.readFileSync(path.join(sourceDir, 'mock/modal-catalog-data.js'), 'utf8'))(catalog);

const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'liberdus-mock-'));
try {
  const write = (name, content) => fs.writeFileSync(path.join(stageDir, name), content);
  const assets = new Set(['fonts/LICENSE.txt', 'LICENSE']);
  const addAsset = (url) => {
    const relative = url.replace(/^\.\.\//, '').replace(/^\.\//, '');
    if (!/^(media|fonts)\//.test(relative) || relative.split('/').includes('..')) {
      throw new Error(`Unsupported rendering asset: ${url}`);
    }
    assets.add(relative);
  };
  const collectImages = (markup) => {
    for (const [, url] of markup.matchAll(/\b(?:src|poster)="([^"]+)"/g)) {
      if (/^(?:data:|https?:|\$\{)/.test(url) || url.endsWith('.js')) continue;
      addAsset(url);
    }
  };
  let html = fs.readFileSync(path.join(sourceDir, 'mock/index.html'), 'utf8');
  const stylesheetReference = 'new URL("../styles.css", window.location.href)';
  if (!html.includes(stylesheetReference)) throw new Error('Mock stylesheet loading changed; update this exporter.');
  html = html.replace(stylesheetReference, 'new URL("./styles.css", window.location.href)').replaceAll('../media/', './media/');
  html = html.replace('</title>', '</title>\n    <link rel="icon" href="./media/liberdus_logo_50.png" />');
  collectImages(html);
  addAsset('media/liberdus_logo_50.png');

  const states = fs.readFileSync(path.join(sourceDir, 'mock/proposal-states.js'), 'utf8');
  const stateWindow = {};
  new Function('window', states)(stateWindow);
  collectImages(stateWindow.PROPOSAL_STATE_MARKUP);
  const standaloneStates = states.replaceAll('../media/', './media/');

  for (const entry of catalog.MODAL_CATALOG) {
    collectImages(entry.markup);
    entry.markup = entry.markup.replace(/\b(src|href)="([^"]+)"/g, (attribute, kind, url) => {
      if (url.startsWith('../media/')) return `${kind}="${url.replace('../media/', './media/')}"`;
      // Source-code links are documentation, not runtime dependencies. Keep them
      // navigable without shipping app.js, crypto libraries, or network files.
      if (kind === 'href' && !url.startsWith('#') && !/^https?:/.test(url) && url !== 'styles.css') {
        return `${kind}="https://github.com/Liberdus/web-client-v2/blob/main/${url.replace(/^\.\.\//, '')}"`;
      }
      return attribute;
    });
  }
  const css = fs.readFileSync(path.join(sourceDir, 'styles.css'), 'utf8');
  for (const [, url] of css.matchAll(/url\(["']?([^\s)"']+)/g)) {
    if (!/^(?:data:|https?:|#)/.test(url)) addAsset(url);
  }
  write('index.html', html);
  write('proposal-states.js', standaloneStates);
  write('styles.css', css);
  write('modal-catalog-data.js', `// Standalone modal markup; source-code links point upstream.\nwindow.MODAL_CATALOG_SOURCE = ${JSON.stringify(catalog.MODAL_CATALOG_SOURCE)};\nwindow.MODAL_CATALOG = ${JSON.stringify(catalog.MODAL_CATALOG, null, 2)};\n`);
  for (const asset of assets) {
    const destination = path.join(stageDir, asset);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(sourceDir, asset), destination);
  }
  write('README.md', `# Liberdus UI mock

Standalone rendering files copied from web-client-v2 branch \`${branch}\`,
commit \`${commit}\`. The updater copies the source working tree, including any
uncommitted mock edits.

Open \`/mock/\` on the website, or \`/mock/?tab=proposals\` for the proposal gallery.
No build, package installation, app.js, dao.js, wallet, or backend is needed.
The scripts render static previews; buttons do not submit transactions.

## Refresh

From the website repository, run:

\`./update-mock.sh\`

The script finds the \`dao-mock-proposal-states\` worktree registered with the sibling
\`web-client-v2\` repository. To choose another source checkout:

\`./update-mock.sh /path/to/web-client-v2-checkout\`

Node.js and Git are required for updating. The source validator runs before website
files are changed. Only rendering scripts, HTML, a stylesheet snapshot, referenced
fonts/images, and licenses are copied. Existing unrelated files are preserved.
The updater does not change the source checkout, commit, or push.

## Preview locally

From this folder: \`python3 -m http.server 8766 --bind 127.0.0.1\`

Then open http://localhost:8766/?tab=proposals. Serve over HTTP rather than file://
so iframe interactions work consistently. Scroll to pan, click a device to interact,
and use Escape, an outside click, or any canvas zoom to clear device focus.
The two-column milestone override is contained in the mock HTML.
`);
  // Everything needed was prepared successfully before writing the website copy.
  fs.cpSync(stageDir, targetDir, { recursive: true });
  console.log(`Updated ${targetDir} from ${sourceDir} (${branch} @ ${commit}).`);
} finally {
  fs.rmSync(stageDir, { recursive: true, force: true });
}
NODE
