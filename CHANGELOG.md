# Changelog

## Unreleased

- Added backend environment validation for required auth/database settings.
- Added committed backend and frontend environment examples for ZIP/clone setup.
- Made REST and Socket.io dev endpoints configurable for Android/LAN testing.
- Made backend CORS origins configurable instead of localhost-only.
- Added a dependency-free PWA baseline so Gramchat can be installed from supported Windows and Android browsers.
- Added app manifest metadata, standalone display settings, shortcuts, theme color, and a Gramchat SVG icon.
- Added a frontend service worker that caches shell/static assets while keeping API and Socket.io traffic live.
