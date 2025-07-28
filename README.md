# Hedera ID Wallet (Web MVP)

A minimal-viable wallet that lets users:

* Register with **email or mobile number** via OTP  
* Log in with **OTP or biometric authentication (WebAuthn/FIDO2)**  
* Automatically receive a **Decentralized Identifier (DID)** on first registration  
* Store basic **Verifiable Credentials (VCs)** in the browser  
* View / share credentials through a simple React UI  

The goal is to showcase modern, password-less sign-in combined with self-sovereign identity primitives (DIDs + VCs) using a familiar Web2 experience.

---

## ✨ Features

1. **User Registration**  
   • Email or phone + name  
   • OTP sent via Email (SendGrid) or SMS (Twilio)  
   • DID (`did:key:` by default, optional Hedera `did:hedera:` testnet) is generated and stored

2. **Password-less Login**  
   • Enter email / phone → receive OTP → verify → issue JWT

3. **Biometric Login (WebAuthn)**  
   • On first OTP login the user is prompted to enroll FaceID / TouchID / Windows Hello  
   • Subsequent visits can skip OTP and use biometrics (`navigator.credentials.get()`)

4. **DID & Credential Storage**  
   • Private key kept in IndexedDB (or encrypted localStorage)  
   • VCs stored client-side for MVP; future: backup/sync to cloud or Hedera consensus

5. **Simple Wallet UI**  
   • Shows the user’s DID, list of VCs, QR code sharing, import/export

---

## 🛠 Technology Stack

| Layer      | Tech                                                     |
|------------|----------------------------------------------------------|
| Frontend   | React 18 + Vite, TypeScript, TailwindCSS                 |
| Auth       | Firebase Auth **or** custom Node + Express + Twilio/SendGrid |
| Biometrics | `@simplewebauthn/browser` & `@simplewebauthn/server`     |
| Backend    | Node.js 18, Express, TypeScript                          |
| Identity   | `@affinidi/wallet-sdk` **or** `@identity.com/credential-wallet-sdk` |
| DID/VC     | `did:key`, `did:hedera` (via `@hashgraph/sdk`)           |
| Storage    | IndexedDB (Dexie)                                        |
| Monorepo   | npm workspaces, **client** / **server** folders          |

---

## 📂 Project Structure

```
hedera-id-wallet/
├── client/            # React front-end
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── hooks/
│   └── vite.config.ts
├── server/            # Node/Express back-end
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.ts         # OTP endpoints
│   │   │   └── webauthn.ts     # FIDO2 register/verify
│   │   ├── models/user.ts
│   │   └── utils/
│   └── tsconfig.json
├── common/            # Shared DID / VC helpers
├── package.json       # root workspace scripts
└── README.md
```

---

## ⚡️ Quick Start

### Prerequisites
* Node.js ≥ 18  
* npm ≥ 8  
* (Optional) Hedera testnet account + operator key for `did:hedera:` anchoring  
* Twilio / SendGrid credentials for OTP delivery

### 1. Clone & Install
```bash
git clone https://github.com/your-org/hedera-id-wallet.git
cd hedera-id-wallet
npm run install:all   # installs root, client, server deps
```

### 2. Environment Variables

Create `.env` in `/server`:

```
PORT=4000
JWT_SECRET=supersecret
OTP_PROVIDER=twilio         # or 'sendgrid'
TWILIO_SID=...
TWILIO_AUTH_TOKEN=...
SENDGRID_API_KEY=...
HEDERA_OPERATOR_ID=0.0.xxxx
HEDERA_OPERATOR_KEY=302e...
```

### 3. Run in Development

```bash
npm run dev
```

* `client` served at `http://localhost:5173`  
* `server` API at `http://localhost:4000`  

### 4. Production Build

```bash
npm run build      # builds React
npm run start      # serves API and static client
```

---

## 🔁 User Flow

```
[Register]
   └─▶ Enter email / phone
         └─▶ Receive & submit OTP
               └─▶ DID generated → wallet home
                     └─▶ Prompt: "Enable biometric login?"
[Return Visit]
   ├─▶ Use biometric (if enrolled) → JWT
   └─▶ Or request new OTP
```

---

## 📚 API Overview

| Method | Endpoint                | Purpose                        |
|--------|-------------------------|--------------------------------|
| POST   | `/auth/request-otp`     | Send OTP to email / phone      |
| POST   | `/auth/verify-otp`      | Verify OTP & issue JWT         |
| POST   | `/webauthn/register`    | Begin FIDO2 registration       |
| POST   | `/webauthn/verifyReg`   | Complete registration          |
| POST   | `/webauthn/authenticate`| Begin biometric login          |
| POST   | `/webauthn/verifyAuth`  | Complete biometric login       |

All protected routes expect `Authorization: Bearer <JWT>`.

---

## 🔐 WebAuthn Sequence (High-level)

1. Client calls `/webauthn/register` → server returns `{ challenge, rpId, user }`.
2. Browser executes `navigator.credentials.create(...)`.
3. Attestation response sent to `/webauthn/verifyReg` → server validates & stores public key.
4. Later login: client hits `/webauthn/authenticate` → receives challenge.
5. `navigator.credentials.get(...)` returns assertion → `/webauthn/verifyAuth`.
6. On success, server issues new JWT.

---

## 🆔 DID Generation

Default: `did:key` (ed25519).  
If Hedera credentials supplied, the SDK creates an account alias and returns `did:hedera:testnet:<did>` anchored on the public ledger.

Keys are generated client-side with WebCrypto and stored in IndexedDB (Dexie). Private keys never leave the browser in this MVP.

---

## 📄 Verifiable Credential Storage

For demonstration, VCs are encrypted using `crypto.subtle.encrypt` with a key derived from WebAuthn or a device-specific secret and placed in IndexedDB. Future roadmap includes:

* Off-device backup (e.g., encrypted sync with user’s cloud)
* Presentation exchange & OpenID4VC flows

---

## 🚀 Roadmap

* Multi-device sync  
* Credential issuance flow (OIDC bridge)  
* Revocation & status lists  
* Push notifications for new credentials  
* Polished UI/UX and theming  

---

## 🤝 Contributing

1. Fork the repo & create your branch (`git checkout -b feature/awesome`).
2. Commit your changes (`git commit -am 'Add awesome feature'`).
3. Push to the branch (`git push origin feature/awesome`).
4. Create a new Pull Request.

---

## 📑 License

MIT © 2025 San Francisco AI Factory – Autonomy for software engineering.
