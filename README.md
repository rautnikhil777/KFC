# Voice + Touch AI Restaurant Ordering System (Phase 1)

## Overview
This repository contains a full-stack restaurant ordering system with:
- **Frontend**: React + Vite + React Router + Context API + CSS Modules
- **Backend**: Node.js + Express + MongoDB (Atlas) + Mongoose

Phase 1 implements the full ordering flow (Welcome → Voice/Touch → Menu → Cart → Confirm → Kitchen → Track → Bill → Payment) with responsive UI.

> **Table logic**: Orders always include `table` information resolved via `session/config` on the server. QR-based linking is supported by configuration structure for future integration.

---

## Repo structure
- `frontend/` - React app
- `backend/` - Express API + Mongoose models

---

## Frontend
### Install
```bash
cd frontend
npm install
```

### Run (dev)
```bash
npm run dev
```

### Build
```bash
npm run build
```

---

## Backend
### Install
```bash
cd backend
npm install
```

### Configure environment
```bash
cd backend
copy .env.example .env
```


### Configure environment
Copy the example:
```bash
cd backend
copy .env.example .env
```

### Run (dev)
```bash
npm run dev
```

### Test / Validate build
```bash
npm run lint
npm run build
```

---

## Deployment
### Frontend (Vercel)
- Set `VITE_API_BASE_URL` in Vercel project environment variables.
- Build command: `npm run build`
- Output directory: `dist`

### Backend (Render)
- Connect MongoDB Atlas via `MONGODB_URI`.
- Set `PORT` and any other env vars.
- Start command: `npm run start`

---

## Phase 2
Phase 2 will add/extend:
- Voice (speech-to-text UI, confirmation)
- Kitchen dashboard improvements
- Billing enhancements
- Payment integrations (still dummy placeholder for Phase 1)
- Natural language understanding / intent detection


