# Gramchat 💬

A full-stack WhatsApp-clone built with React, Node.js, MongoDB, and Socket.io.

> Built by **RoniKid** & **Modestus** 

---

## Features

### Platform Targets
- Windows and Android first via installable PWA support
- Browser fallback for development and unsupported install flows
- Apple, macOS, and Linux planned later

### Messaging
- Real-time 1-on-1 messaging via Socket.io
- Typing indicators and read receipts (✓ Sent / ✓✓ Seen)
- Reply to any message (quoted preview)
- Emoji reactions on messages (toggle on/off)
- In-conversation message search with keyword highlighting and keyboard navigation
- Image, document, and video file sharing via Cloudinary

### Groups
- Create group chats with a custom name and avatar
- Add/remove members (admin only)
- Group typing indicators
- Reply and react inside group chats
- Group info modal with live member management

### Status / Stories
- Post text or image statuses (24-hour auto-expiry via MongoDB TTL)
- Custom background colors for text statuses
- Story viewer with progress bars and tap-to-navigate
- Viewed-by count (visible to status owner only)

### Calls
- Voice calls (WebRTC peer-to-peer)
- Video calls with picture-in-picture local preview
- Mute / camera toggle during calls
- Live call duration timer
- Ringtone via Web Audio API (no audio files needed)
- Incoming call screen with Accept / Decline

### UI / UX
- Light and dark theme toggle (DaisyUI)
- Clickable user profile modal from any chat header
- Mobile-responsive layout with back navigation
- 700+ emoji picker with 7 category tabs and search
- Online/offline indicators throughout

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Zustand, Tailwind CSS, DaisyUI |
| Backend | Node.js, Express |
| Database | MongoDB (local), Mongoose |
| Real-time | Socket.io |
| Media | Cloudinary |
| Calls | WebRTC + Google STUN servers |
| Auth | JWT + HTTP-only cookies |
| Install target | PWA baseline for Windows and Android browsers |

---

## Project Structure

```
Gramchat/
├── backend/
│   └── src/
│       ├── controllers/   # auth, message, group, status
│       ├── models/        # User, Message, Group, Status
│       ├── routes/        # REST API routes
│       ├── lib/           # db, socket, cloudinary
│       ├── middleware/    # JWT auth guard
│       └── index.js       # Express entry point
└── frontend/
    └── src/
        ├── components/    # ChatContainer, Sidebar, CallOverlay, etc.
        ├── pages/         # HomePage, ProfilePage, StatusPage, etc.
        ├── store/         # Zustand stores (chat, group, status, call)
        └── lib/           # axios instance, utils
```

---

## Getting Started

### Prerequisites

- Node.js v18+
- MongoDB running locally on `mongodb://localhost:27017`
- A free [Cloudinary](https://cloudinary.com) account

### 1. Clone the repo

```bash
git clone https://github.com/roni-kid/Gramchat.git
cd Gramchat
```

### 2. Install dependencies

Run the project setup command from the repository root:

```bash
npm run setup
```

This installs both `backend/node_modules` and `frontend/node_modules`. If you skip this step, `npm run dev` inside `frontend/` will fail because `vite` is installed locally, not globally.

### 3. Set up the backend environment

Create a `.env` file inside `backend/`:

```env
PORT=5001
MONGODB_URI=mongodb://localhost:27017/gramchat
JWT_SECRET=your_jwt_secret_here
CLIENT_URL=http://localhost:5173,http://127.0.0.1:5173
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
NODE_ENV=development
```

You can also copy `backend/.env.example` to `backend/.env` and replace the placeholder values.

### 4. Set up the frontend environment

For normal Windows development, no frontend `.env` is required. For Android testing from a phone on the same Wi-Fi, copy `frontend/.env.example` to `frontend/.env` and replace `192.168.1.20` with the Windows PC LAN IP. Add the matching `http://YOUR_PC_IP:5173` origin to `CLIENT_URL` in `backend/.env`.

### 5. Run the app

From the repository root:

```bash
npm run dev
```

Or run the two apps in separate terminals:

```bash
# Terminal 1 — backend
cd backend
npm run dev

# Terminal 2 — frontend
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

Check backend health at `http://localhost:5001/api/health`. It should return:

```json
{ "status": "ok" }
```

When testing from Android, start Vite with a network host:

```bash
cd frontend
npm run dev -- --host 0.0.0.0
```

Then open `http://YOUR_PC_IP:5173` on the Android device.

---

## Environment Variables

The `.env` file is **never committed to Git**. Each developer must create their own. See Step 3 above.

If `npm run dev` in `frontend/` says `'vite' is not recognized`, dependencies were not installed. Run `npm run setup` from the repository root, or run `npm install` inside `frontend/`.

If signup/login says the backend cannot be reached, start the backend and confirm `http://localhost:5001/api/health` works. Also check `VITE_API_BASE_URL` if you created `frontend/.env`.

If signup/login returns `Internal Server Error`, check that `backend/.env` exists, `JWT_SECRET` is set, MongoDB is running, and `MONGODB_URI` points to the running MongoDB instance.

---

## Pushing Updates

On Windows, use the helper script from the project root:

```bat
push-to-github.bat "Describe the update"
```

The script checks required setup files, runs the frontend build, stages normal repository changes, commits, and pushes the current branch to GitHub. It relies on `.gitignore` so local files like `node_modules`, `dist`, `.env`, and Codex attachment folders are not uploaded. New users rebuild dependencies from the committed `package-lock.json` files with `npm run setup`.

---

## Roadmap

- [x] Phase 1 — Profile modal, themes, full emoji panel, message search
- [x] Phase 2 — Group chats, status/stories, reactions, replies, file sharing
- [x] Phase 3 — Voice & video calls (WebRTC)
- [x] Phase 4 - Installable Windows and Android PWA baseline
- [ ] TURN server support for calls across strict NATs
- [ ] Push notifications
- [ ] Message forwarding
- [ ] Starred messages

---

## License

MIT — do whatever you want with it.
