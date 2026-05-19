# 10000
A score keeping app for the dice game  [Dice 10000](https://en.wikipedia.org/wiki/Dice_10000).

## Features
- Add/Remove players
- Keep track of player scores

## Architecture
- React
- Vite
- Material-UI

## Development
1. Clone the repository
2. Run `pnpm install`
3. Run `pnpm dev` for the Vite frontend

The frontend dev server proxies `/api` requests to the local backend on port
8081. To run the backend directly, run `pnpm --dir server dev`.

## Conductor
Conductor uses a production-shaped local stack:

1. Setup: `pnpm install`
2. Run: `pnpm run conductor:run`
3. Archive: `pnpm run conductor:archive`

The Conductor run builds the Docker image and starts it with a Firestore
emulator. The app is available at `http://localhost:8080`, and metrics events
are written to the local emulator instead of a GCP project. Override
`APP_PORT` or `FIRESTORE_EMULATOR_PORT` if those host ports are already in use.

Conductor enables local admin access automatically against the Firestore
emulator. The backend only honors this bypass when `FIRESTORE_EMULATOR_HOST` is
set.

To exercise the production Google sign-in path locally instead, disable the
local bypass and set Google admin config:

```sh
VITE_ADMIN_AUTH_BYPASS=false \
ADMIN_AUTH_BYPASS=false \
VITE_GOOGLE_CLIENT_ID=your-client-id \
GOOGLE_CLIENT_ID=your-client-id \
ADMIN_EMAIL=you@example.com \
pnpm run conductor:run
```

## Deployment
Cloud deployment is handled by `.github/workflows/deploy-gcp.yml`. Pushes to
`master` build the Docker image, push it to Artifact Registry, and deploy it to
Cloud Run. The Cloud Run service serves the built Vite app and the Hono backend
from the same container.

The Cloud Run deployment uses real Firestore through Application Default
Credentials on the configured runtime service account. Runtime configuration is
provided by GitHub Actions variables: `GCP_PROJECT`, `GCP_REGION`, `RUNTIME_SA`,
`VITE_GOOGLE_CLIENT_ID`, and `ADMIN_EMAIL`.

The GitHub Pages workflow still builds static frontend assets, but that path
does not run the backend metrics API.
