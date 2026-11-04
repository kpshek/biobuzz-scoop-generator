# BioBuzz Scoop Generator

An offline HTML/JavaScript tool for designing a curved shooter scoop with a rotatable 3D preview, binary STL export, and shareable JSON settings. Open **BioBuzz_Scoop_Generator.html** in Chrome or Edge. No installation, server, build step, or external JavaScript dependencies are required.

## Public website and automatic deployment

Open **[BioBuzz Scoop Generator](https://kpshek.github.io/biobuzz-scoop-generator/)** to use the hosted app. The hosted app processes JSON and STL files locally in your browser, just like the downloaded HTML.

GitHub Pages uses the [Deploy GitHub Pages workflow](https://github.com/kpshek/biobuzz-scoop-generator/actions/workflows/pages.yml). Every push to `main` runs the settings and STL checks, copies `BioBuzz_Scoop_Generator.html` to the published site's `index.html`, includes the example JSON configurations, and deploys the result. The standalone source file remains the single application source; there is no duplicate HTML to maintain. Tests and repository configuration are excluded from the site artifact.

Repository **Settings > Pages > Build and deployment > Source** must be set to **GitHub Actions**. To redeploy an existing commit, open **Actions > Deploy GitHub Pages > Run workflow** and select `main`. A failed check stops publication. The workflow uses the `github-pages` environment and needs no additional secrets or packages.

The deployment directory `_site/` is generated during the workflow and is ignored by Git. The app also remains usable offline by opening the standalone HTML file.

## Use the generator

1. Open `BioBuzz_Scoop_Generator.html` in your browser.
2. Set the entry and exit outside widths, main ramp length, overall height, and exit angle. Equal widths produce a constant-width scoop; different widths produce a smooth taper after the entry mounting column.
3. Set the entry extension length. Zero omits the extension. A positive value adds a floor-only entry ramp beyond the side walls, at the full entry outside width, with a leading lip that rises gradually from 0.6 mm to the floor height. Total length is the main ramp length plus this extension.
4. Choose the material preset, dimension-conflict behavior, mounting grid, and STL quality. Drag the preview to rotate and scroll to zoom.
5. Click **Generate & download STL** and inspect the resulting model in your slicer. Dimensions are in millimeters.

## Share configurations

Click **Export settings JSON** to download all 15 editable settings. To restore or share a design, click **Import settings JSON** and select a saved JSON file. The controls and preview update together. Files are processed locally; nothing is uploaded. Invalid JSON, missing fields, unsupported choices, out-of-range values, and invalid geometry are rejected while retaining the previous settings.

Ready-to-import examples:

| File | Entry / exit widths | Main length | Height | Angle | Entry extension |
| --- | --- | --- | --- | --- | --- |
| `examples/default-settings.json` | 87 / 87 mm | 120 mm | 150 mm | 65° | 0 mm |
| `examples/120-to-60-20mm-settings.json` | 120 / 60 mm | 120 mm | 150 mm | 65° | 20 mm |

Both use the lightweight preset, exact dimensions, and standard STL quality. The tapered example has a total length of 140 mm. Its 60 mm exit is narrower than the 71 mm reference ball diameter, which produces an advisory warning while allowing export.

Settings files use `format: "biobuzz-scoop-settings"`, `schemaVersion: 1`, `units: "mm"`, and a `settings` object. Required settings are `width`, `exitWidth`, `length`, `height`, `angle`, `entryExtension`, `preset`, `fit`, `entry`, `step`, `ball`, `hole`, `mountDepth`, `pitch`, and `edge`. The `step` field maps to the STL quality control (1.25 fast, 0.85 standard, 0.6 fine). Optional export metadata includes `exportedAt` and the original generator revision. The schema version describes the JSON format; Git tracks application revisions.

## Printing and current limitations

- The entry-end mounting grid is provisional: it has not been matched to the original goBILDA STEP reference. Mounting holes are restricted to the entry support columns.
- STL output contains three closed, slightly overlapping shells. Inspect the slicer's union/repair result and layer preview before printing.
- Strong narrowing may introduce overhangs. Check ball and wheel clearance, fastening, entry-extension stiffness, and print orientation for your design.
- WebGL provides the 3D preview, with a Canvas fallback when unavailable. STL generation remains local.

## Project files and checks

- `BioBuzz_Scoop_Generator.html` — standalone application, adapted from the supplied HTML by removing version labels from the filename and interface; geometry and JSON behavior are preserved.
- `examples/` — portable configurations for import.
- `tests/app.test.cjs` — dependency-free checks for settings export/import, rejection and rollback, and binary STL output for both examples.
- `.gitattributes` — consistent text line endings.
- `.gitignore` — excludes generated STL exports, local settings, and common editor/OS files.

With Node.js 18 or newer installed, run:

```sh
node --test tests/app.test.cjs
```

These checks exercise the application script with a minimal browser stub; they do not validate real browser rendering or slicer behavior.

Source conversation: [Design Curved Shooting Guide](https://chatgpt.com/c/6ae7be32-b298-83ea-b4b9-140782f391c0). The public website is hosted on GitHub Pages; no remote or network connection is required to run the downloaded HTML.
