# 🏏 Cricket Academy Management System

A professional, responsive admin portal for managing a cricket academy — players, batches, attendance, fees, and coach profiles — built with HTML, Bootstrap 5, Vanilla JavaScript, and Firebase SDK v10.

---

## 🚀 Quick Setup

### Step 1 — Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **"Add Project"** and create a new Firebase project
3. In your project, go to **Authentication** → **Sign-in method** → Enable **Email/Password**
4. Create your admin account: **Authentication** → **Users** → **Add User**
5. Go to **Firestore Database** → **Create Database** → Select **Production Mode** (or Test Mode for development)
6. Go to **Project Settings** (⚙️ icon) → **Your Apps** → Click **Web** (`</>`) → Register app → Copy the `firebaseConfig` object

### Step 2 — Configure Firebase in the Project

Open `js/firebase-db.js` and replace the placeholder config:

```javascript
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID",
};
```

### Step 3 — Apply Firestore Security Rules

In Firebase Console → **Firestore** → **Rules** tab, paste the contents of `firebase/firestore.rules`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Click **Publish**.

### Step 4 — Run the Project Locally

> ⚠️ You **must** run the project through an HTTP server (not by opening HTML files directly in a browser). This is required because ES Modules (`type="module"`) are blocked by browsers over `file://` protocol.

```bash
# Install dev server (one time)
npm install

# Start local server at http://localhost:3000
npm run dev
```

This will automatically open your browser at `http://localhost:3000`.

---

## 📁 Project Structure

```
Cricket/
├── index.html          ← Login Page
├── dashboard.html      ← Main Dashboard
├── players.html        ← Player Management
├── coach.html          ← Coach Profile
├── batches.html        ← Batch Management
├── attendance.html     ← Attendance Marking
├── fees.html           ← Fee Tracking
│
├── css/
│   └── style.css       ← Full design system (dark/light theme)
│
├── js/
│   ├── firebase-db.js  ← Firebase init + CRUD helpers
│   ├── auth-guard.js   ← Route protection
│   ├── sidebar.js      ← Shared sidebar injection
│   ├── main.js         ← Toast, theme, logout, exports
│   ├── dashboard.js    ← Dashboard stats + Chart.js
│   ├── players.js      ← Player CRUD
│   ├── coach.js        ← Coach profile
│   ├── batches.js      ← Batch CRUD
│   ├── attendance.js   ← Attendance marking + history
│   └── fees.js         ← Payment tracking
│
├── assets/
│   ├── login_bg.png    ← Login background
│   ├── coach.png       ← Coach avatar
│   └── logo.png        ← Academy logo
│
└── firebase/
    └── firestore.rules ← Security rules
```

---

## 🔥 Firestore Collections

| Collection     | Purpose                              |
|----------------|--------------------------------------|
| `players`      | Player records (name, age, fees, etc)|
| `coach_info`   | Single coach document (id: `main`)   |
| `batches`      | Training batch definitions           |
| `attendance`   | Per-player per-date attendance logs  |
| `fees`         | Payment records and fee statuses     |

---

## ✨ Features

- 🔐 **Firebase Authentication** — Admin-only email/password login
- 📊 **Real-time Dashboard** — Live stats from Firestore with Chart.js attendance visualization
- 👥 **Player Management** — Full CRUD with search, filter, and export
- 🏋️ **Batch Management** — Card-based UI with capacity tracking
- 📅 **Attendance** — Per-day marking with Present/Absent/Excused toggles
- 💰 **Fee Tracking** — Payment history, quick mark-as-paid, and summary cards
- 🌙 **Dark/Light Mode** — Persistent across all pages
- 📤 **Export** — Excel (.xlsx) and PDF for player and fee tables
- 📱 **Fully Responsive** — Mobile-first sidebar with overlay
- 🛡️ **Crash-Proof** — Every Firebase call wrapped in try/catch, all DOM access null-checked

---

## 🚢 Deployment (Firebase Hosting)

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize hosting in the project directory
firebase init hosting

# When asked:
# → Select your Firebase project
# → Public directory: . (current directory)
# → Configure as single-page app: No
# → Overwrite index.html: No

# Deploy
firebase deploy
```

---

## 🎨 Tech Stack

| Technology         | Purpose                         |
|--------------------|---------------------------------|
| HTML5              | Structure                       |
| Vanilla CSS        | Design system (dark/light mode) |
| Bootstrap 5.3      | Layout, components, modals      |
| Bootstrap Icons    | Icon system                     |
| Google Fonts       | Inter + Outfit typography       |
| Firebase SDK v10   | Auth + Firestore (ESM imports)  |
| Chart.js 4         | Dashboard attendance charts     |
| SheetJS (XLSX)     | Excel export                    |
| jsPDF + autoTable  | PDF export                      |

---

## 📞 Support

Configure your Firebase project and follow the steps above. If you encounter any issues, ensure:
1. Firebase credentials in `js/firebase-db.js` are correct
2. Email/Password sign-in is enabled in Firebase Auth
3. An admin user exists in Firebase Authentication
4. Firestore is created and security rules are published
5. The project is served over HTTP (not `file://`)
"# Cricket-Academy" 
