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

### 2. Set up the backend

```bash
cd backend
npm install
```

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

### 3. Set up the frontend

```bash
cd ../frontend
npm install
```

For normal Windows development, no frontend `.env` is required. For Android testing from a phone on the same Wi-Fi, copy `frontend/.env.example` to `frontend/.env` and replace `192.168.1.20` with the Windows PC LAN IP. Add the matching `http://YOUR_PC_IP:5173` origin to `CLIENT_URL` in `backend/.env`.

### 4. Run the app

```bash
# Terminal 1 — backend
cd backend
npm run dev

# Terminal 2 — frontend
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

When testing from Android, start Vite with a network host:

```bash
cd frontend
npm run dev -- --host 0.0.0.0
```

Then open `http://YOUR_PC_IP:5173` on the Android device.

---

## Environment Variables

The `.env` file is **never committed to Git**. Each developer must create their own. See Step 2 above.

If signup/login returns `Internal Server Error`, check that `backend/.env` exists, `JWT_SECRET` is set, MongoDB is running, and `MONGODB_URI` points to the running MongoDB instance.

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
