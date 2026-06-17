# ⚙️ Mobora — Backend

The REST API and real-time WebSocket server for the **Mobora** platform. Built with **Node.js**, **Express 5**, **MySQL 8**, and **Socket.IO 4**.

---

## ✨ Features

- 🔐 **JWT Authentication** — Stateless auth with `HttpOnly` cookie delivery and refresh token flow
- 🛡️ **Security Hardened** — Helmet headers, CORS restriction, rate limiting, bcrypt password hashing
- ✅ **Yup Validation** — Schema-based request body validation via reusable middleware
- 💬 **Real-Time Messaging** — Socket.IO for vendor ↔ customer and vendor ↔ vendor (B2B) chat
- 🗃️ **Auto-Migration** — Database and all tables are created automatically on first boot
- 📁 **File Uploads** — Attachment handling with static file serving
- 📊 **Role-Based Access** — Route-level enforcement of `vendor` role via middleware

---

## 🛠️ Tech Stack

| Tool                  | Purpose                                     |
|-----------------------|---------------------------------------------|
| Node.js               | Runtime environment                         |
| Express 5             | HTTP server framework                       |
| MySQL 8               | Relational database                         |
| mysql2/promise        | Async MySQL driver with connection pooling  |
| Socket.IO 4           | Real-time bidirectional events              |
| jsonwebtoken          | JWT signing & verification                  |
| bcryptjs              | Password hashing                            |
| Yup                   | Request schema validation                   |
| Helmet                | HTTP security headers                       |
| express-rate-limit    | Brute-force & DDoS protection               |
| cookie-parser         | Cookie reading middleware                   |
| dotenv                | Environment variable management             |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+
- **MySQL** 8.0+ (running locally or remote)

### Install & Run

```bash
# 1. Navigate to backend folder
cd backend

# 2. Copy the example env file
cp .env.example .env

# 3. Edit .env with your credentials (see Environment Variables below)

# 4. Install dependencies
npm install

# 5. Start the development server
npm run dev
```

The server will start at **[http://localhost:5000](http://localhost:5000)**.

> The `mobora` database and all tables are **automatically created** on first boot. No manual SQL setup required.

---

## 🔧 Environment Variables

Copy `.env.example` to `.env` and configure the values:

```env
# Server
PORT=5000

# Database (MySQL)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=mobora

# JWT Authentication
JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_EXPIRES_IN=1d

# CORS — must match your frontend origin
FRONTEND_URL=http://localhost:3000

# Developer Options
# true  → vendors are auto-approved on registration (no admin step)
# false → vendors start as 'pending' and need manual activation
AUTO_APPROVE_VENDORS=false
```

| Variable               | Default                  | Required | Description                                    |
|------------------------|--------------------------|:--------:|------------------------------------------------|
| `PORT`                 | `5000`                   | No       | Express server port                            |
| `DB_HOST`              | `127.0.0.1`              | No       | MySQL host                                     |
| `DB_PORT`              | `3306`                   | No       | MySQL port                                     |
| `DB_USER`              | `root`                   | No       | MySQL username                                 |
| `DB_PASSWORD`          | *(empty)*                | No       | MySQL password                                 |
| `DB_NAME`              | `mobora`                 | No       | Database name (auto-created)                   |
| `JWT_SECRET`           | —                        | **Yes**  | Secret for signing JWTs — change in production |
| `JWT_EXPIRES_IN`       | `1d`                     | No       | Access token time-to-live                      |
| `FRONTEND_URL`         | `http://localhost:3000`  | No       | Allowed CORS origin                            |
| `AUTO_APPROVE_VENDORS` | `false`                  | No       | Skip vendor approval workflow                  |

---

## 📁 Directory Structure

```
backend/
├── config/
│   └── db.js                     # MySQL pool init + auto table migration
│
├── controllers/
│   └── vendor/
│       ├── AuthController.js          # register, login, logout, refresh,
│       │                              # getProfile, updateProfile, changePassword
│       ├── ChatController.js          # getSessions, createSession, getVendors,
│       │                              # getMessages, sendMessage, uploadFile
│       ├── CustomerController.js      # getCustomers, getCustomer, createCustomer,
│       │                              # updateCustomer, deleteCustomer, etc.
│       ├── NotificationController.js  # getNotifications, markRead, markAllRead, etc.
│       └── SpecificationController.js # getMetrics, getAllSpecs, getBrands, etc.
│
├── middleware/
│   ├── authMiddleware.js         # JWT verification (authenticateToken)
│   │                            # + role check (requireRole)
│   └── validationMiddleware.js  # Yup schema validation (validateBody)
│
├── models/
│   └── vendorModel.js           # Vendor DB query helpers
│
├── routes/
│   ├── index.js                 # Aggregator — mounts all route namespaces
│   └── vendor/
│       ├── authRoutes.js        # /api/vendor/auth routes
│       ├── chatRoutes.js        # /api/vendor/chat routes
│       └── notificationRoutes.js # /api/vendor/notifications routes
│
├── utils/
│   └── socketHandler.js         # Socket.IO connection & event handling
│
├── uploads/                     # Served statically at /uploads
├── .env.example                 # Environment variable template
├── .env                         # Local config (git-ignored)
├── index.js                     # Application entry point
└── package.json
```

---

## 🔌 API Reference

Base URL: `http://localhost:5000/api`

### 🔐 Vendor Auth — `/api/vendor/auth`

| Method | Endpoint            | Auth | Description                             |
|--------|---------------------|:----:|-----------------------------------------|
| `POST` | `/register`         | ❌   | Register a new vendor account           |
| `POST` | `/login`            | ❌   | Authenticate and receive JWT cookie     |
| `POST` | `/logout`           | ❌   | Clear the auth cookie                   |
| `POST` | `/refresh`          | ❌   | Issue a new access token from cookie    |
| `GET`  | `/profile`          | ✅   | Get the authenticated vendor's profile  |
| `PUT`  | `/profile`          | ✅   | Update profile details and/or avatar    |
| `PUT`  | `/change-password`  | ✅   | Change account password                 |

> ✅ = Requires `Authorization: Bearer <token>` header and `vendor` role.

#### Register — `POST /api/vendor/auth/register`

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123",
  "confirmPassword": "securePassword123"
}
```

#### Login — `POST /api/vendor/auth/login`

```json
{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful.",
  "vendor": { "id": 1, "name": "John Doe", "email": "john@example.com", "status": "active" },
  "token": "<jwt>"
}
```

---

### 💬 Chat — `/api/vendor/chat`

| Method | Endpoint                      | Auth | Description                          |
|--------|-------------------------------|:----:|--------------------------------------|
| `GET`  | `/sessions`                   | ✅   | List all chat sessions for vendor    |
| `POST` | `/sessions`                   | ✅   | Create a new customer/B2B session    |
| `GET`  | `/vendors`                    | ✅   | List all vendors (for B2B chat)      |
| `GET`  | `/sessions/:chatId/messages`  | ✅   | Fetch all messages in a session      |
| `POST` | `/upload`                     | ✅   | Upload a file/image attachment       |
| `POST` | `/message`                    | ✅   | Send a message to a session          |

---

### 🩺 System

| Method | Endpoint   | Description                          |
|--------|------------|--------------------------------------|
| `GET`  | `/health`  | Returns `{ status: "ok", timestamp }` |

---

## 🗃️ Database Schema

Tables are auto-created via `config/db.js` on server boot. Schema migrations (adding columns) are also applied automatically.

### `vendors`

```sql
CREATE TABLE vendors (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  email            VARCHAR(255) NOT NULL UNIQUE,
  password         VARCHAR(255) NOT NULL,          -- bcrypt hashed
  phone            VARCHAR(50)  DEFAULT NULL,
  shop_name        VARCHAR(255) DEFAULT NULL,
  address          TEXT         DEFAULT NULL,
  payment_methods  TEXT         DEFAULT NULL,      -- JSON array
  profile_img      LONGTEXT     DEFAULT NULL,      -- base64 image
  status           VARCHAR(50)  DEFAULT 'pending', -- pending | active | rejected
  created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### `chat_sessions`

```sql
CREATE TABLE chat_sessions (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  chat_id             VARCHAR(50)  NOT NULL UNIQUE,
  vendor_id           INT          NOT NULL REFERENCES vendors(id),
  customer_name       VARCHAR(255) NOT NULL,
  customer_phone      VARCHAR(50)  DEFAULT NULL,
  customer_email      VARCHAR(255) DEFAULT NULL,
  avatar              VARCHAR(10)  DEFAULT NULL,
  status              VARCHAR(20)  DEFAULT 'offline',
  last_message        TEXT         DEFAULT NULL,
  unread_count        INT          DEFAULT 0,
  last_active         VARCHAR(50)  DEFAULT NULL,
  device_interest     VARCHAR(255) DEFAULT NULL,
  notes               TEXT         DEFAULT NULL,
  is_group            TINYINT(1)   DEFAULT 0,
  group_name          VARCHAR(255) DEFAULT NULL,
  group_members       TEXT         DEFAULT NULL,   -- JSON array of vendor IDs
  recipient_vendor_id INT          DEFAULT NULL,   -- B2B target vendor
  created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### `messages`

```sql
CREATE TABLE messages (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  chat_id          VARCHAR(50)  NOT NULL REFERENCES chat_sessions(chat_id),
  sender           VARCHAR(20)  NOT NULL,          -- 'vendor' | 'customer'
  sender_id        INT          DEFAULT NULL,
  sender_name      VARCHAR(255) DEFAULT NULL,
  text             TEXT         DEFAULT NULL,
  timestamp        VARCHAR(50)  DEFAULT NULL,
  status           VARCHAR(20)  DEFAULT 'sent',    -- sent | delivered | read
  attachment_type  VARCHAR(20)  DEFAULT NULL,      -- 'image' | 'file'
  attachment_name  VARCHAR(255) DEFAULT NULL,
  attachment_size  VARCHAR(50)  DEFAULT NULL,
  attachment_url   LONGTEXT     DEFAULT NULL,
  created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔒 Security

| Layer              | Implementation                                                   |
|--------------------|------------------------------------------------------------------|
| **Headers**        | `helmet()` — sets CSP, HSTS, X-Frame-Options, etc.              |
| **CORS**           | Restricted to `FRONTEND_URL` only; credentials allowed          |
| **Rate Limiting**  | Global: 200 req/15 min · Auth routes: 30 req/15 min             |
| **Auth**           | JWT in `HttpOnly` cookie; tokens verified on every protected req |
| **Passwords**      | Hashed with `bcryptjs` (salt rounds: 10)                        |
| **Validation**     | All request bodies validated with Yup before reaching controller |
| **Uploads**        | Body size limited to `10 MB`                                     |

---

## 🔄 Authentication Flow

```
Client                          Server
  │                               │
  ├── POST /api/vendor/auth/login ─►│
  │                               ├── Validate credentials
  │                               ├── Sign JWT (JWT_SECRET)
  │◄── Set-Cookie: token=<jwt> ───┤
  │                               │
  ├── GET /api/vendor/auth/profile ►│  (cookie sent automatically)
  │   Authorization: Bearer <jwt>  │
  │                               ├── authMiddleware verifies JWT
  │                               ├── requireRole('vendor') check
  │◄── 200 { vendor: {...} } ─────┤
  │                               │
  ├── POST /api/vendor/auth/refresh►│  (when token expires)
  │                               ├── Read token from cookie
  │                               ├── Issue new JWT
  │◄── Set-Cookie: token=<new> ───┤
```

---

## 📜 Scripts

```bash
npm run dev    # Start server with node (development)
npm start      # Start server with node (production)
```

> **Tip:** For live-reload during development, install `nodemon` globally and use `nodemon index.js`.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit: `git commit -m 'feat: your feature description'`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

---

<p align="center">Part of the <strong>Mobora</strong> platform — <a href="../README.md">View full project README</a></p>
