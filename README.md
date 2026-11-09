# BioBuzz Part Studio

Three browser tools for the BioBuzz robot. Keep the HTML files in the same folder, open **BioBuzz_Scoop_Generator.html** in Chrome or Edge, and use the top navigation. Each page works offline with no server or build step.

- **Scoop** generates a curved shooter scoop with a 10 mm preview grid, preset and free-orbit views, binary STL export, and shareable JSON settings.
- **Fins** generates a servo-mounted rotor with 0–4 fins, adjustable length, height and thickness, optional angled tip cuts, and rounded roots. Use **Extra height above holes** to raise the top edge without moving the screw row. **Independent fins** lays the selected fins flat as separate pieces in one STL. Each piece has two mounting holes. The preview measures each edge of the selected fin's side profile, and **Export settings JSON** saves all model settings.
- **Alliance plates** generates red and blue FTC signs for a team number. Plates start at 165 × 69 mm and widen as needed for 57 mm digits and at least 6 mm of margin. This page uses the device's installed Arial Bold font. Print the 2.4 mm base in the alliance color, then switch to white at the first raised-digit layer.

## Public website and automatic deployment

Open **[BioBuzz Part Studio](https://kpshek.github.io/biobuzz-scoop-generator/)** to use the hosted site. It opens the scoop generator and processes JSON and STL files locally in your browser.

GitHub Pages uses the [Deploy GitHub Pages workflow](https://github.com/kpshek/biobuzz-scoop-generator/actions/workflows/pages.yml). Every push to `main` runs the scoop and fin checks, then publishes the three HTML pages and example JSON configurations. The workflow also copies the scoop page to `index.html` so the existing home URL opens it. Tests and repository configuration are excluded from the site artifact.

Repository **Settings > Pages > Build and deployment > Source** must be set to **GitHub Actions**. To redeploy an existing commit, open **Actions > Deploy GitHub Pages > Run workflow** and select `main`. A failed check stops publication. The workflow uses the `github-pages` environment and needs no additional secrets or packages.

The deployment directory `_site/` is generated during the workflow and is ignored by Git.

## Use the generator

1. Open `BioBuzz_Scoop_Generator.html` in your browser.
2. Set the entry and exit outside widths, main ramp length, overall height, and exit angle. Equal widths produce a constant-width scoop; different widths produce a smooth taper after the entry mounting column.
3. Set the entry extension length. Zero omits the extension. A positive value adds a floor-only entry ramp beyond the side walls, at the full entry outside width, with a leading lip that rises gradually from 0.6 mm to the floor height. Total length is the main ramp length plus this extension.
4. Choose the material preset, dimension-conflict behavior, mounting grid, and STL quality. Use **Iso**, **Top**, or **Side** to change views. Drag to orbit and use the zoom buttons or scroll wheel to zoom.
5. Click **Generate & download STL** and inspect the resulting model in your slicer. Dimensions are in millimeters.

## Share configurations

Click **Export settings JSON** to download all 15 editable settings. To restore or share a design, click **Import settings JSON** and select a saved JSON file. The controls and preview update together. Files are processed locally; nothing is uploaded. Invalid JSON, missing fields, unsupported choices, out-of-range values, and invalid geometry are rejected while retaining the previous settings.

Ready-to-import examples:

| File | Entry / exit widths | Main length | Height | Angle | Entry extension |
| --- | --- | --- | --- | --- | --- |
| `examples/default-settings.json` | 90 / 81 mm | 120 mm | 150 mm | 65° | 50 mm |
| `examples/120-to-60-20mm-settings.json` | 120 / 60 mm | 120 mm | 150 mm | 65° | 20 mm |

The default configuration uses solid sides, fine STL quality, a 50 mm entry-column depth, and a total length of 170 mm. The tapered example uses the lightweight preset and standard STL quality. Both keep exact dimensions. The tapered example has a total length of 140 mm. Its 60 mm exit is narrower than the 71 mm reference ball diameter, which produces an advisory warning while allowing export.

Settings files use `format: "biobuzz-scoop-settings"`, `schemaVersion: 1`, `units: "mm"`, and a `settings` object. Required settings are `width`, `exitWidth`, `length`, `height`, `angle`, `entryExtension`, `preset`, `fit`, `entry`, `step`, `ball`, `hole`, `mountDepth`, `pitch`, and `edge`. The `step` field maps to the STL quality control (1.25 fast, 0.85 standard, 0.6 fine). Optional export metadata includes `exportedAt` and the original generator revision. The schema version describes the JSON format; Git tracks application revisions.

## Printing and current limitations

- The entry-end mounting grid is provisional: it has not been matched to the original goBILDA STEP reference. Mounting holes are restricted to the entry support columns.
- STL output contains three closed, slightly overlapping shells. Inspect the slicer's union/repair result and layer preview before printing.
- Strong narrowing may introduce overhangs. Check ball and wheel clearance, fastening, entry-extension stiffness, and print orientation for your design.
- WebGL provides the 3D preview, with a Canvas fallback when unavailable. STL generation remains local.

## Project files and checks

- `BioBuzz_Scoop_Generator.html` — standalone scoop generator.
- `BioBuzz-Fin-Studio.html` — standalone fin generator.
- `FTC-Alliance-Plate.html` — standalone alliance plate generator.
- `examples/` — portable configurations for import.
- `tests/app.test.cjs` — dependency-free checks for settings export/import, rejection and rollback, and binary STL output for both examples.
- `tests/fin.test.cjs` — dependency-free checks for the fin margin, independent STL pieces, live edge measurements, and settings export.
- `.gitattributes` — consistent text line endings.
- `.gitignore` — excludes generated STL exports, local settings, and common editor/OS files.

With Node.js 18 or newer installed, run:

```sh
node --test
```

These checks exercise the application script with a minimal browser stub; they do not validate real browser rendering or slicer behavior.

Source conversation: [Design Curved Shooting Guide](https://chatgpt.com/c/6ae7be32-b298-83ea-b4b9-140782f391c0). The public website is hosted on GitHub Pages; no remote or network connection is required to run the downloaded HTML.
