# Changelog

## Unreleased

- Added a Windows `push-to-github.bat` helper that verifies required clone/setup files, builds the frontend, commits, and pushes the current branch.
- Ignored local Codex attachment folders so screenshots and temporary prompt files are not accidentally committed.
- Added root setup/dev scripts so a fresh clone can install and run backend plus frontend from the project root.
- Added dependency preflight messages for backend and frontend dev scripts when `node_modules` has not been installed.
- Improved auth failure toasts so frontend users see backend connection/setup problems instead of only generic signup/login failures.
- Added a lightweight `/api/health` backend endpoint for local setup checks.
- Added backend environment validation for required auth/database settings.
- Added committed backend and frontend environment examples for ZIP/clone setup.
- Made REST and Socket.io dev endpoints configurable for Android/LAN testing.
- Made backend CORS origins configurable instead of localhost-only.
- Added a dependency-free PWA baseline so Gramchat can be installed from supported Windows and Android browsers.
- Added app manifest metadata, standalone display settings, shortcuts, theme color, and a Gramchat SVG icon.
- Added a frontend service worker that caches shell/static assets while keeping API and Socket.io traffic live.
