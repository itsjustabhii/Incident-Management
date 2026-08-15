# Enterprise Incident & Support Management Platform

A production-ready enterprise incident and support management system built with React, Node.js, PostgreSQL, and Redis.

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- npm 10+

### 1. Clone and configure environment

```bash
# Copy the environment template
cp .env.example .env

# Edit .env with your values (especially secrets — use random 64-byte hex strings for JWT secrets)
# Generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 2. Start with Docker Compose (recommended)

```bash
# Start all services (PostgreSQL, Redis, API server, React client)
npm run docker:up

# Wait for services to be healthy, then run migrations + seed
npm run db:migrate
npm run db:seed
```

The application will be available at:
- **Client**: http://localhost:3000
- **API**: http://localhost:5000/api/v1
- **API Health**: http://localhost:5000/api/v1/health/ready

### 3. Local development (without Docker)

```bash
# Install all dependencies
npm install

# Start PostgreSQL and Redis via Docker (just the DBs)
docker-compose up -d postgres redis

# Start both client and server in watch mode
npm run dev
```

### Demo Accounts

After running `npm run db:seed`:

| Email | Password | Role |
|-------|----------|------|
| admin@incidenthub.dev | Admin1234! | ADMIN |
| manager@incidenthub.dev | Manager1234! | MANAGER |
| engineer@incidenthub.dev | Engineer1234! | ENGINEER |
| viewer@incidenthub.dev | Viewer1234! | VIEWER |

## Project Structure

```
incident-management-platform/
├── client/               # React + Vite frontend
│   └── src/
│       ├── features/     # Domain feature modules (auth, incidents, dashboard)
│       ├── components/   # Reusable UI components
│       ├── pages/        # Route-level page components
│       ├── store/        # Redux store + RTK Query API
│       ├── hooks/        # Custom React hooks
│       └── ...
├── server/               # Express.js API + Socket.IO
│   └── src/
│       ├── controllers/  # HTTP handlers
│       ├── services/     # Business logic
│       ├── routes/       # Express routers
│       ├── middleware/   # Auth, RBAC, validation, errors
│       ├── websocket/    # Socket.IO server
│       └── jobs/         # Background cron jobs
├── docker/               # Docker and nginx config
├── docker-compose.yml    # Multi-service orchestration
├── ARCHITECTURE.md       # Full system architecture documentation
└── .env.example          # Environment variable template
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start client + server in development mode |
| `npm run docker:up` | Start all Docker services |
| `npm run docker:down` | Stop all Docker services |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed the database with demo data |
| `npm run db:studio` | Open Prisma Studio |
| `npm test` | Run all tests |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run lint` | Lint all workspaces |
| `npm run format` | Format all files with Prettier |

## Architecture

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the complete system architecture including:

- System overview diagram
- Frontend/Backend directory structure
- Database schema and indexes
- Redis key namespaces
- WebSocket event catalog
- Authentication and RBAC design
- SLA calculation logic
- Audit logging design
- API endpoint reference
- Testing strategy
- Docker deployment strategy

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Redux Toolkit, RTK Query, Material UI, Recharts |
| Forms | React Hook Form + Zod |
| Real-time | Socket.IO client |
| Backend | Node.js, Express.js |
| Database | PostgreSQL 16 + Prisma ORM |
| Cache | Redis 7 + ioredis |
| Auth | JWT (access + refresh token rotation) |
| Logging | pino |
| Testing | Jest, React Testing Library, Playwright |
| Containers | Docker, Docker Compose |
