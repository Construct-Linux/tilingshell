# Tiling Shell for CONSTRUCT

[Tiling Shell](https://github.com/domferr/tilingshell) by Domenico Ferraro: a GNOME
Shell extension (`tilingshell@ferrarodomenico.com`) with layouts, snap assistant,
edge tiling, keyboard tiling, a layout editor and multi-monitor support. Its user
documentation is upstream's README.

This fork is what CONSTRUCT ships. It runs on **GNOME Shell 51 only**: the build
for shells 42-44 and every branch for shells older than 51 are removed, and
`metadata.json` declares `"51"` alone. Branch `gnome-51`.

## Changes from upstream

Based on upstream's `v18.0` branch at `832aac5a` (18.0 release candidate, which
added GNOME 51).

Fixes, each worth sending upstream:

- `tilingManager: take the seat from the stage's backend`:
  `Clutter.get_default_backend()` is gone in mutter 51; a tablet pen over the
  stage threw on every motion event.
- `fix: destroy the tiling managers in disable()`: they outlived every screen
  lock since #560 (upstream #559).
- `fix: give a restored window back its tile`: a window unmaximized back into
  its tile is tiled again (upstream #372).

Build and cleanup:

- `package-lock.json` is tracked, so `npm ci` installs exactly what was tested.
- GNOME Shell 51 only: no legacy build (Babel import rewriting, polyfills,
  `dist_legacy/`), no `Config.PACKAGE_VERSION` comparisons, no probes for APIs
  that 51 always or never has, no Gdk subprocess for monitor names.
- No extensions.gnome.org packaging, Vagrant VMs, upstream GitHub templates or
  README media.

## Build

```sh
npm ci --no-audit --no-fund
node esbuild.mjs
glib-compile-resources --sourcedir=./gresources \
  --target=./dist/resources.gresource ./gresources/resources.gresource.xml
```

Needs Node.js 22, npm, glib (`glib-compile-resources`). `esbuild.mjs` compiles
`src/` (TypeScript, SCSS) into `dist/` and copies `resources/` (metadata,
schema, icons, compiled translations). `dist/` is the extension directory:
CONSTRUCT installs it under
`/usr/share/gnome-shell/extensions/tilingshell@ferrarodomenico.com` and the
schema under `/usr/share/glib-2.0/schemas`, compiled with the image.

`npm run build` also compiles the schema into `dist/schemas`, for a per-user
install with `npm run install:extension`. Translations live in `translations/`
(`npm run update-translations` regenerates the catalogs and `resources/locale`).

## License

GPL-3.0-or-later, as the source headers say (`LICENSE` is the GPLv3 text).
Tiling Shell is © Domenico Ferraro and its contributors; the translations are
by their translators.
