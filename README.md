# Monitoring + RBAC Upgrade

This project now includes:

- React frontend (main website + admin console)
- Express backend with secure authentication and role-based access control
- Text-file credential storage (regular users and admin credentials kept separate)
- Text-file activity and notification logging
- Real-time admin notifications via WebSocket with polling fallback
- Analytics dashboard (timeline + per-user activity charts)

## Tech Stack

- Frontend: Vite, React, TypeScript, Tailwind, Recharts
- Backend: Node.js, Express, JWT, bcrypt, WebSocket (`ws`)
- Storage: text files in `server/data`

## Role Model

- `primary_admin`
  - Full access
  - Can create, update, deactivate, delete users
  - Can promote regular users to admin
- `admin`
  - Can access main website, dashboard, notifications, user list (read-only)
  - Cannot manage users
  - Cannot manage/delete primary admin
- `user`
  - Main website only
  - No dashboard, notifications, or user management

## Text File Storage

Location: `server/data/`

- `users.txt`
  - Regular users only
  - Format per line: `username:hashed_password`
- `admin_credentials.txt`
  - Admin and primary admin credentials
  - Format per line: `username:hashed_password`
- `primary_admins.txt`
  - Usernames marked as primary admin (one per line)
- `deactivated_users.txt`
  - Usernames disabled from login (one per line)
- `wird_config.txt`
  - Global wird list and points
  - Format per line: `name|type|points`
- `worship_reports.txt`
  - One JSON report record per line, scoped by `username`
- `user_activity_log.txt`
  - Format: `YYYY-MM-DD HH:mm:ss, username, action, ip`
- `admin_notifications.txt`
  - Format: `YYYY-MM-DD HH:mm:ss, username, action, admin_username`

## Security Controls

- Passwords are hashed with `bcrypt` (`bcryptjs`) and never stored in plain text.
- Sessions are JWT-based and stored in secure HTTP-only cookies.
- Authorization is enforced server-side with RBAC middleware.
- Session role is re-derived from text files on each request to prevent stale privilege escalation.
- Admin-only endpoints are protected against direct URL/API bypass.
- Primary admin account is protected from deletion.

## Environment Setup

Copy `.env.example` to `.env` and set values:

```bash
API_PORT=3001
DATA_DIR=./server/data
JWT_SECRET=replace-with-strong-secret
JWT_EXPIRES_IN=8h
SESSION_MAX_AGE_MS=28800000
BCRYPT_ROUNDS=12
PRIMARY_ADMIN_USERNAME=primary-admin
PRIMARY_ADMIN_PASSWORD=ChangeMe!2026
```

If no credentials exist, startup bootstraps the primary admin using
`PRIMARY_ADMIN_USERNAME` + `PRIMARY_ADMIN_PASSWORD`.

## Local Development

Install dependencies:

```bash
npm install
```

Run frontend + backend together:

```bash
npm run dev:full
```

Or run separately:

```bash
npm run server:dev
npm run dev
```

Frontend: `http://localhost:8080`  
Backend API: `http://localhost:3001`

Vite proxy is configured for `/api` and `/ws`, so frontend requests can use relative paths.

## API Overview

- Auth
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- User activity
  - `POST /api/activity/action`
  - `POST /api/activity/page-access`
- Global wird config
  - `GET /api/wird-config` (all authenticated users)
  - `PUT /api/wird-config` (admin + primary admin only)
- Reports
  - `POST /api/reports` (save current day report for logged-in user)
  - `GET /api/reports?window=1d|7d|1w|1m|all[&username=foo]`
  - `GET /api/reports/export.csv?window=...` (Excel-compatible CSV)
  - `DELETE /api/reports` (clear own reports)
- Admin
  - `GET /api/admin/analytics/timeline?days=7|30|90`
  - `GET /api/admin/analytics/per-user?days=7|30|90`
  - `GET /api/admin/notifications`
  - `GET /api/admin/users`
  - `POST /api/admin/users` (primary admin only)
  - `PATCH /api/admin/users/:username` (primary admin only)
  - `DELETE /api/admin/users/:username` (primary admin only)
  - `POST /api/admin/users/:username/promote` (primary admin only)

## Important Operations Notes

- Change bootstrap primary admin password immediately after first login.
- Restrict read/write access to `server/data` at OS level.
- Back up `server/data` regularly.
- Rotate `JWT_SECRET` carefully (existing sessions will become invalid).
- Wird tab configuration is now global and server-owned; admin edits affect all users.
- Reports tab is role-scoped: admins can view/export all user accounts; regular users can only view/export their own reports.
