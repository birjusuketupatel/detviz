# Determinant Visualizer
#### Birju Patel

Determinant Visualizer is an interactive teaching tool for the determinant of a `3 x 3` matrix. It presents the determinant as:

- volume, computed by orthogonalizing the column vectors with Gram-Schmidt
- orientation, determined by decomposing the orthogonal factor with Householder reflections

The current app is a static browser experience in [`docs/`](./docs), built with client-side JavaScript and Three.js for deployment on GitHub Pages. The original Python / PyVista prototype is preserved in [`misc/`](./misc).

## Live Site

The production site will be hosted on GitHub Pages at:

```text
https://www.detviz.com/
```

## What The App Does

- lets students enter a `3 x 3` matrix
- visualizes the spanned parallelepiped in 3D
- steps through Gram-Schmidt to show how determinant magnitude comes from volume
- shows Householder mirror placements and reflections to explain determinant sign through orientation
- supports step-by-step navigation, reset, and camera controls for desktop and mobile
- handles singular matrices by showing the degenerate geometry and reporting determinant `0`

## Project Structure

- [`docs/`](./docs): static site served by GitHub Pages
- [`docs/index.html`](./docs/index.html): page structure and explainer content
- [`docs/app.js`](./docs/app.js): Three.js viewer and interaction logic
- [`docs/math-core.mjs`](./docs/math-core.mjs): determinant, QR, Gram-Schmidt, and Householder math
- [`scripts/check-release.mjs`](./scripts/check-release.mjs): release verification script
- [`misc/`](./misc): legacy Python implementation and supporting files

## Local Preview

From the repository root:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/docs/
```

## Release Check

Before publishing, run:

```bash
npm run check:release
```

This verifies:

- determinant and step generation for the example matrix
- singular-matrix fallback behavior
- QR volume math on a diagonal matrix
- Householder reflection and mirror-plane normal logic
- static page import wiring for Three.js and OrbitControls

## Deployment

This project is intended to be deployed as a static GitHub Pages site from the [`docs/`](./docs) directory, with `www.detviz.com` configured as the custom domain.

## Legacy Python Prototype

The Python version is not the primary deployment target, but it remains in the repository as the original prototype.

To run it locally:

```bash
python -m venv .venv
python -m pip install -r misc/requirements.txt
python misc/det_viz.py
```
