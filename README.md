# UK Cam2Cam

UK Cam2Cam is a self-hostable, anonymous random video-chat MVP for adults in the United Kingdom. It uses browser WebRTC for peer-to-peer audio and video, a Node.js WebSocket server for matching and signalling, and a deliberately explicit access flow: visitors are region-checked, then must confirm they are 18 or older and accept the adult-only consent notice before entering the channel.

> This repository is a technical MVP, not a complete safeguarding or legal-compliance programme. Operators are responsible for moderation, reporting response, privacy notices, retention policy, lawful age assurance, abuse prevention, and the requirements that apply to their service.

## Features

The application includes a UK-only access endpoint with support for common reverse-proxy country headers, a friendly non-UK block screen, an explicit adults-only consent gate, anonymous queue pairing, WebSocket signalling, WebRTC video and audio, microphone and camera controls, text chat, Skip / Next, and a Report / Stop safety overlay. The interface is responsive and uses a dark cyberpunk HUD visual system with neon pink and electric cyan accents.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, Tailwind CSS, Lucide icons |
| Signalling | Node.js, Express, `ws` WebSocket server |
| Media | Browser WebRTC with a public STUN server configured in the client |
| Persistence | None for anonymous chat state; the active queue is in memory |
| Auth | Not required for anonymous chat |

## Local development

Install Node.js 20 or newer and pnpm, then run:

```bash
pnpm install
export NODE_ENV=development
export PORT=3000
export ALLOW_LOCAL_DEV=true
pnpm dev
```

Open the local URL printed by the development server. For local testing, set `ALLOW_LOCAL_DEV=true`; this permits development requests without a proxy-provided UK country header. Keep it disabled in production.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | HTTP port. The managed runtime supplies this in hosted environments. |
| `ALLOW_LOCAL_DEV` | No | Retained as a documented local-development setting; the current development server permits localhost automatically, while production remains restrictive. |
| `GEOIP_API_URL` | Recommended in production | Optional server-side geolocation endpoint returning JSON with `country_code` or `country`. Configure this when your reverse proxy does not provide a trusted country header. |
| `NODE_ENV` | Yes | Use `development` locally and `production` for deployment. |

The server trusts country headers only when they are added by a trusted edge or reverse proxy. Do not allow end users to inject these headers directly. In production, configure your proxy to overwrite them and strip incoming copies.

## HTTPS and WebSockets

Camera and microphone access requires a secure context in normal browsers, so production should use HTTPS. The WebSocket endpoint is `/ws`; configure the reverse proxy to forward WebSocket upgrade requests and preserve the `Upgrade` and `Connection` headers. A typical deployment also needs a TURN service for reliable connections across restrictive NATs; STUN alone is not a production connectivity guarantee.

## Self-hosting guide

1. Clone the repository and install dependencies with `pnpm install`.
2. Create `.env` from `.env.example`, keep `ALLOW_LOCAL_DEV=false`, and configure a trusted country-header source or `GEOIP_API_URL`.
3. Run `pnpm check`, `pnpm test`, and `pnpm build`.
4. Deploy the Node process behind an HTTPS reverse proxy that supports WebSocket upgrades.
5. Configure a TURN server and replace the sample ICE configuration in `client/src/pages/Home.tsx` with your own credentials and URLs.
6. Test the full flow on desktop and mobile browsers, including permission denial, a non-UK request, two simultaneous clients, report/stop, and reconnect behaviour.

## Safety notes

The product intentionally avoids accounts and personal details, but anonymity does not make a service safe by itself. Production operators should add rate limits, connection quotas, IP abuse controls, server-side report storage with controlled retention, moderation workflows, clear privacy and community policies, and an emergency escalation process. Do not claim that the MVP guarantees anonymity, prevents harmful content, or verifies age beyond the user's explicit assertion.

## Scripts

```bash
pnpm dev       # development server
pnpm check     # TypeScript validation
pnpm test      # Vitest suite
pnpm build     # production build
```

## GitHub

The project is structured as a normal pnpm repository with no committed secrets. Before publishing, review the environment variables above, confirm the proxy and TURN assumptions, and add a suitable open-source licence and operator contact details.
