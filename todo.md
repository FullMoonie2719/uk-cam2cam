# Project TODO

- [x] Add UK-only IP geolocation gate with friendly non-UK block screen
- [x] Add prominent 18+ age verification and consent screen that must be accepted before chat access
- [x] Add anonymous random matchmaking queue with exact “Find a Stranger” button label
- [x] Add WebSocket signalling server for WebRTC offer, answer, and ICE exchange
- [x] Add peer-to-peer video and audio feeds with microphone mute and camera toggle controls
- [x] Add in-call text chat panel
- [x] Add Skip / Next flow that disconnects and re-enters the queue
- [x] Add Report / Stop safety overlay and immediate session termination
- [x] Add responsive dark cyberpunk visual system with neon pink and electric cyan HUD details
- [x] Add self-hosting README with setup, environment variables, deployment, and safety notes
- [x] Add vitest coverage for geolocation gating and matchmaking/signalling helpers
- [x] Validate desktop and mobile layouts in the running preview
- [x] Prepare a GitHub-ready repository structure and publishing handoff

- [x] Align WebSocket UK gating with the `/api/geo` logic, including trusted proxy headers and optional geolocation fallback
- [x] Normalize matchmaking country codes so GB and UK users pair consistently
- [x] Rebuild media and RTCPeerConnection on Skip / Next rematches
- [x] Add a real environment template or correct the README setup instructions
- [x] Add Vitest coverage for pairing, relay, skip, stop, report, and disconnect cleanup
- [x] Create an explicit GitHub publishing handoff or publish after user authorization
- [x] Add a signalling test that closes one matched client and verifies peer-left/disconnect cleanup behavior and queue/session state reset
- [x] Extend disconnect cleanup test to verify the remaining client can re-enter matchmaking after the peer leaves

- [x] Add a polished landing page with product positioning, UK-only and 18+ messaging, safety highlights, and a CTA into the existing consent flow
