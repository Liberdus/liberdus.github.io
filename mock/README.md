# Liberdus UI mock

Standalone rendering files copied from web-client-v2 branch `dao-mock-proposal-states`,
commit `300b7859`. The updater copies the source working tree, including any
uncommitted mock edits.

Open `/mock/` on the website, or `/mock/?tab=proposals` for the proposal gallery.
No build, package installation, app.js, dao.js, wallet, or backend is needed.
The scripts render static previews; buttons do not submit transactions.

## Refresh

From the website repository, run:

`./update-mock.sh`

The script finds the `dao-mock-proposal-states` worktree registered with the sibling
`web-client-v2` repository. To choose another source checkout:

`./update-mock.sh /path/to/web-client-v2-checkout`

Node.js and Git are required for updating. The source validator runs before website
files are changed. Only rendering scripts, HTML, a stylesheet snapshot, referenced
fonts/images, and licenses are copied. Existing unrelated files are preserved.
The updater does not change the source checkout, commit, or push.

## Preview locally

From this folder: `python3 -m http.server 8766 --bind 127.0.0.1`

Then open http://localhost:8766/?tab=proposals. Serve over HTTP rather than file://
so iframe interactions work consistently. Scroll to pan, click a device to interact,
and use Escape, an outside click, or any canvas zoom to clear device focus.
The two-column milestone override is contained in the mock HTML.
