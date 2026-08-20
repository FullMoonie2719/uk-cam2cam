# GitHub publishing handoff

The repository is ready to publish as `uk-cam2cam`. It contains the React client, Node/Express server, WebSocket signalling service, unit and integration tests, and a self-hosting README. No environment values or credentials are committed.

## Pre-publish validation

```bash
pnpm install
pnpm check
pnpm test
pnpm build
```

The current validation result is 8 passing tests across three suites, a passing TypeScript check, and a successful production build. The Vite build reports only a non-blocking bundle-size advisory.

## Publish steps

1. Create an empty GitHub repository named `uk-cam2cam` under the intended owner or organisation.
2. Add the repository remote and push the default branch:

```bash
git remote add origin git@github.com:OWNER/uk-cam2cam.git
git branch -M main
git add .
git commit -m "Build UK-only anonymous video chat MVP"
git push -u origin main
```

3. Configure production environment variables, an HTTPS reverse proxy with WebSocket upgrades, a trusted UK country header or `GEOIP_API_URL`, and a TURN service for reliable WebRTC connectivity.
4. Review the safety and safeguarding responsibilities in `README.md` before making the service public.

In this workspace, the GitHub connection is present but disabled, so the final push requires the owner to enable GitHub access in the project integrations/settings panel or provide an authorized repository destination.
