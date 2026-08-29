# HUM–TUM 💜 (WhatsApp Clone)

**HUM–TUM** is a pure JavaScript (React JS + Node.js) full-stack WhatsApp Clone designed for **Hostinger Shared Hosting** with **Hostinger MySQL** database support.

---

## 🌟 Core Features

- **💬 WhatsApp Dual-Pane Layout**: Desktop two-panel layout (Left: conversations list, status stories, search; Right: active chat room with doodle background, message tails & blue double ticks).
- **🚀 Pure JavaScript (No TypeScript)**: No `tsc` compilers, no `@types/*`, zero compilation overhead on Hostinger.
- **⚡ Real-Time Socket.IO**: Instant messaging, live typing indicators, and online/offline presence updates.
- **🗄️ Hostinger MySQL Native**: Powered by `mysql2/promise` with auto-table initialization (`humtum_*` tables) and seamless in-memory fallback.
- **📸 24-Hour Stories & Statuses**: Disappearing status updates with full-screen auto-advancing viewer.
- **📞 Audio & Video Calling**: In-app WebRTC incoming and active call HUD overlays.
- **📱 Responsive Mobile Experience**: Automatic full-width single pane view on mobile screens.

---

## 🛠️ Local Development

```bash
# 1. Install dependencies
npm install

# 2. Build client
npm run build

# 3. Start full-stack server
npm start
```

Open `http://localhost:3000` in your browser.

---

## 🌐 Hostinger Shared Hosting Deployment

### Step 1: Connect via SSH
```bash
ssh -p 65002 u245050038@31.97.225.216
cd ~/domains/humtum.webtrionix.com/public_html
```

### Step 2: Pull Latest Code
```bash
git pull origin main
```

### Step 3: Install & Build
```bash
npm install
npm run build
```

### Step 4: Configure Database in `.env`
Create or update `.env` in the project root:
```env
PORT=3000
NODE_ENV=production
CLIENT_URL=https://humtum.webtrionix.com

DB_HOST=localhost
DB_PORT=3306
DB_USER=u245050038_humtum
DB_PASSWORD=YourHostingerDbPassword
DB_NAME=u245050038_humtum
JWT_SECRET=humtum_jwt_secret_key_2026
```

### Step 5: Start or Restart Application
```bash
npm start
```
Or restart the Node.js Web App directly from your **Hostinger hPanel Dashboard**.
