# Determinant Visualizer
#### Birju Patel

## Web Version

A static browser version now lives in [`docs/`](./docs). It ports the determinant walkthrough from PyVista to client-side JavaScript with Three.js, so it can be hosted on GitHub Pages without a Python server.

The original Python / PyVista implementation now lives in [`misc/`](./misc).

### Features

- User-editable 3 x 3 matrix input
- Step forward and backward controls
- Touch and mouse orbit controls for mobile and desktop
- Gram-Schmidt volume steps
- Householder mirror and reflection steps

### Local Preview

From the repository root:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/docs/`.

### Release Check

Before publishing, run:

```bash
npm run check:release
```

This checks:

- determinant and step generation for the example matrix
- singular-matrix fallback behavior
- QR volume math on a diagonal matrix
- Householder reflection and mirror-plane normal logic
- static page import wiring for Three.js and OrbitControls

### GitHub Pages Deployment

1. Push this repository to GitHub.
2. In GitHub, open `Settings -> Pages`.
3. Set the source to `Deploy from a branch`.
4. Select your main branch and the `/docs` folder.
5. Save. GitHub Pages will publish the site automatically.

After deployment, the site will be available at:

```text
https://<your-github-username>.github.io/<your-repository-name>/
```

### Low-Cost Server Fallback

You should not need a server for the current feature set. If you later want Python-backed computation, logging, authentication, or saved user sessions, the lowest-friction cheap option is:

- Frontend: keep the static `docs/` site on GitHub Pages
- Backend: small FastAPI app on Render or Railway
- Cost: typically free tier for light use, otherwise low single-digit to low double-digit USD per month depending on uptime and traffic

Minimal backend approach:

1. Keep the 3D viewer in the browser.
2. Expose only JSON endpoints from FastAPI.
3. Deploy the API separately on Render or Railway.
4. Call the API from the static site with `fetch`.

## Instructions

Legacy local Python workflow:

Install Python 3.9.13 from python.org.

```
C:\determinant_visualizer>python --version
Python 3.9.13
```

Create virtual environment.

```
python -m venv .venv
```

Install dependencies.

```
python -m pip install -r misc/requirements.txt
```

Run the original PyVista viewer from `misc/`:

```bash
python misc/det_viz.py
```
