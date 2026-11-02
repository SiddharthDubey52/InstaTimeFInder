# TimeFinder

TimeFinder is a MERN-style web application for organizing Instagram and YouTube URLs by publishing date and time. It supports CSV uploads, metadata processing, date-wise reports, and CSV/Excel exports.

## Features

- Admin authentication with a backend-issued, HttpOnly session cookie
- Protected application pages and API endpoints
- Instagram post and Reel URL analysis
- YouTube video and Shorts URL analysis
- CSV upload with duplicate URL handling
- Date-wise grouping and sorting
- Instagram and YouTube metadata processing
- CSV export
- Formatted Excel export with clickable links
- Responsive interface for mobile, tablet, desktop, and large screens

## Requirements

- Node.js 18 or newer
- npm
- Internet access for public metadata requests

## Installation

Install the root dependencies:

```bash
npm install
```

Install the frontend dependencies:

```bash
npm --prefix client install
```

## Environment configuration

Create a local `.env` file in the project root. Do not commit this file or share its contents.

```env
ADMIN_USERNAME=replace-with-your-admin-username
ADMIN_PASSWORD_HASH=replace-with-a-bcrypt-hash
JWT_SECRET=replace-with-a-long-random-secret
NODE_ENV=development
```

### Generating a password hash

Generate a bcrypt hash locally rather than storing an administrator password in source code:

```bash
node -e "import('bcryptjs').then(async ({ default: bcrypt }) => console.log(await bcrypt.hash(process.argv[1], 12)))" "replace-with-your-password"
```

Use the generated hash as `ADMIN_PASSWORD_HASH`. Never put the plaintext password in this README, frontend code, API responses, screenshots, or source control.

For production, use a strong randomly generated `JWT_SECRET` and set:

```env
NODE_ENV=production
FRONTEND_ORIGIN=https://your-frontend-domain.example
```

The `.env` file is excluded by `.gitignore`.

## Running locally

Start the backend and frontend together:

```bash
npm run dev
```

The default development URLs are:

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000`

Run the backend only:

```bash
npm run server
```

Run the frontend only:

```bash
npm run client
```

## Authentication

The login screen is the only application UI available before authentication.

The backend protects all application APIs except:

- `GET /api/auth/status`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/health`

The session is stored in an HttpOnly cookie and is not stored in `localStorage`. Do not expose `ADMIN_PASSWORD_HASH` or `JWT_SECRET` through frontend code, logs, API responses, or documentation.

## CSV input

The uploader accepts CSV files containing supported URL values. Headerless files are supported.

Instagram URLs may include:

- Posts
- Reels

YouTube URLs may include:

- `youtube.com/watch`
- `youtu.be`
- `youtube.com/shorts`
- `youtube.com/embed`

Metadata availability depends on the public source and platform response. Unavailable fields are reported as unavailable rather than fabricated.

## YouTube metadata

Public YouTube oEmbed metadata is used without exposing credentials in the frontend. Additional official YouTube Data API metadata can be enabled by configuring the backend-only `YOUTUBE_API_KEY` environment variable when available.

Never place an API key in frontend code or commit it to source control.

## Instagram metadata limitations

Instagram metadata is collected only from publicly accessible sources. Availability can vary because of platform restrictions, deleted content, rate limits, privacy settings, or temporary network failures.

The application does not request Instagram passwords, private session cookies, or unauthorized access.

## Testing and building

Run the existing service tests:

```bash
npm test
```

Create a production frontend build. The root build command also installs the separate frontend dependencies, which is required on deployment services such as Render:

```bash
npm run build
```

On Render, use:

- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`

## Security checklist

- Keep `.env` local and private.
- Use a unique production `JWT_SECRET`.
- Use a bcrypt password hash, never a plaintext password.
- Use HTTPS in production.
- Keep production cookies Secure.
- Do not commit API keys, tokens, cookies, passwords, or generated reports.
- Rotate credentials if they are ever exposed.

## Project structure

```text
client/                 React/Vite frontend
server/server.js        Express API entry point
server/middleware/      Authentication middleware
server/services/        Metadata and export services
server/utils/           Shared parsing utilities
```
