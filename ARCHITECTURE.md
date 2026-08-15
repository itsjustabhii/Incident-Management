# Enterprise Incident & Support Management Platform

## System Architecture Overview

### High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        Client Browser / SPA                                │
│   React + Vite + Redux Toolkit + RTK Query + Socket.IO Client              │
└─────────────────────────────┬──────────────────────────────────────────────┘
                              │  HTTPS + WSS
┌─────────────────────────────▼──────────────────────────────────────────────┐
│                    Reverse Proxy / Load Balancer (nginx)                    │
│               Routes /api/* → Express   |   /* → React SPA                 │
└──────┬──────────────────────────────────────────────────────────┬──────────┘
       │                                                          │
┌──────▼───────────────────────────────────┐   ┌─────────────────▼──────────┐
│          Express.js API Server            │   │   Socket.IO Real-time      │
│  Controllers / Services / Repositories   │   │   Namespace: /incidents    │
│  JWT Auth Middleware                      │   │   Namespace: /notifications│
│  RBAC Middleware                          │   │   JWT Socket Auth          │
│  Rate Limiting                            │   │                            │
│  Centralized Error Handler               │   │                            │
└──────┬────────────────────────┬──────────┘   └──────────────┬─────────────┘
       │                        │                              │
┌──────▼──────┐   ┌─────────────▼──────┐        ┌────────────▼─────────────┐
│  PostgreSQL  │   │      Redis         │        │  Redis Pub/Sub           │
│  Prisma ORM  │   │  Session Cache     │        │  (WebSocket event bus)   │
│  Migrations  │   │  Rate Limit Store  │        │                          │
│  Indexes     │   │  SLA Cache         │        │                          │
└─────────────┘   └────────────────────┘        └──────────────────────────┘
```

---

## Frontend Architecture

### Directory Structure
```
client/src/
├── app/               # Redux store + RTK Query API slice
├── components/        # Reusable, domain-agnostic UI components
│   ├── common/        # Buttons, Inputs, Modals, Badges, etc.
│   ├── layout/        # AppShell, Sidebar, Topbar, Breadcrumbs
│   └── feedback/      # Alerts, Skeletons, EmptyState, ErrorBoundary
├── features/          # Domain feature slices (co-locate state + UI)
│   ├── auth/          # Login, Register, AuthGuard, authSlice
│   ├── incidents/     # IncidentList, IncidentDetail, incidentSlice
│   ├── comments/      # CommentThread, commentSlice
│   ├── users/         # UserManagement, Profile, userSlice
│   ├── dashboard/     # KPI cards, SLA charts, workload analytics
│   ├── notifications/ # NotificationBell, notificationSlice
│   └── admin/         # Team management, settings
├── layouts/           # Page-level layout wrappers
├── pages/             # Route-level page components
├── routes/            # React Router config + protected routes
├── hooks/             # Custom React hooks
├── services/          # Axios instance + non-RTK API helpers
├── store/             # Redux store configuration
├── schemas/           # Zod validation schemas
├── utils/             # Pure utility functions
├── constants/         # App-wide enumerations and config
└── theme/             # Material UI theme + global overrides
```

### State Management Strategy
- **Server state**: RTK Query (all API calls, caching, invalidation)
- **Global client state**: Redux slices (auth, notifications, UI preferences)
- **Local component state**: React `useState` / `useReducer`
- **Form state**: React Hook Form + Zod resolvers

### Real-time Integration
- Socket.IO client connects on auth success
- Stores socket ref in a custom `useSocket` hook
- RTK Query cache is manually updated via `dispatch(api.util.updateQueryData)` when WebSocket events arrive
- Socket reconnects automatically with exponential backoff

---

## Backend Architecture

### Directory Structure
```
server/src/
├── config/            # DB, Redis, Multer, environment validation
├── controllers/       # Thin HTTP handlers — delegate to services
├── middleware/        # Auth, RBAC, validation, rate-limit, upload, error
├── routes/            # Express Router definitions
├── services/          # Business logic (pure functions + transactions)
├── repositories/      # All Prisma queries (data access layer)
├── validators/        # Zod schemas for request bodies/params/query
├── models/            # Shared TypeScript/JSDoc type definitions
├── websocket/         # Socket.IO server setup + event handlers
├── notifications/     # In-app + future email notification dispatch
├── utils/             # Logger, async wrapper, pagination, SLA helpers
├── constants/         # Enums: roles, incident statuses, priorities
└── jobs/              # Background cron jobs (SLA escalation, cleanup)
```

### Request Lifecycle
```
HTTP Request
  → Rate Limiter
  → CORS
  → Body Parser
  → Request Logger
  → Route Match
  → Auth Middleware (JWT verify)
  → RBAC Middleware (role check)
  → Input Validator (Zod)
  → Controller
  → Service (business logic + transaction)
  → Repository (Prisma)
  → Response
  → (on error) → Centralized Error Handler → Structured JSON error
```

---

## Database Architecture (PostgreSQL + Prisma)

### Core Models
```
User          → id, email, passwordHash, role, displayName, avatarUrl, active
Team          → id, name, description
TeamMember    → userId, teamId, role (join table)
Incident      → id, title, description, status, priority, category
               → reportedById, assigneeId, teamId
               → slaBreachAt, resolvedAt, closedAt
               → createdAt, updatedAt
Comment       → id, incidentId, authorId, body, isInternal, createdAt
Attachment    → id, incidentId, uploadedById, filename, mimeType, size, storagePath
AuditLog      → id, incidentId, actorId, action, oldValue, newValue, createdAt
Notification  → id, userId, type, title, body, referenceId, read, createdAt
SLAPolicy     → id, name, priority, responseMinutes, resolutionMinutes
```

### Key Indexes
- `incidents(status, priority)` — dashboard / filter queries
- `incidents(assigneeId)` — workload queries
- `incidents(teamId)` — team-scoped queries
- `incidents(slaBreachAt)` — SLA breach detection job
- `audit_logs(incidentId)` — audit history per incident
- `notifications(userId, read)` — unread count badge
- `comments(incidentId)` — comment thread

### Relationships
- User 1→N Incidents (reported)
- User 1→N Incidents (assigned)
- Incident 1→N Comments
- Incident 1→N Attachments
- Incident 1→N AuditLogs
- User 1→N Notifications
- Team N→M Users (via TeamMember)

---

## Redis Architecture

### Key Namespaces
```
session:{userId}           → JWT refresh token (TTL = refresh expiry)
rate:{ip}:{endpoint}       → Rate limiting counters (TTL = window)
sla:breach-queue           → Sorted set: incidentId scored by breachAt epoch
cache:dashboard:{userId}   → Cached dashboard aggregates (TTL = 60s)
cache:incident:{id}        → Individual incident cache (TTL = 30s, invalidated on write)
lock:sla-job               → Distributed lock for the SLA escalation cron
```

### Pub/Sub Channels
```
incident:created           → triggers WebSocket broadcast to team room
incident:updated:{id}      → triggers WebSocket update to incident room
incident:assigned:{userId} → triggers notification to assigned user
comment:added:{incidentId} → triggers WebSocket to incident subscribers
sla:breach:{incidentId}    → triggers escalation notification
```

---

## WebSocket Architecture

### Socket.IO Namespaces
- `/incidents` — incident-level rooms, real-time CRUD broadcasts
- `/notifications` — per-user notification rooms

### Authentication
- `socket.handshake.auth.token` carries the JWT access token
- Middleware verifies token before allowing connection
- Socket is tagged with `socket.data.userId` and `socket.data.role`

### Rooms
- `incident:{id}` — all users viewing a specific incident
- `user:{userId}` — personal notification channel
- `team:{teamId}` — team-wide broadcasts

### Event Catalog
```
Client → Server:
  join_incident  { incidentId }
  leave_incident { incidentId }

Server → Client:
  incident_created    { incident }
  incident_updated    { incidentId, changes }
  incident_deleted    { incidentId }
  comment_added       { comment }
  notification        { notification }
  sla_breach          { incidentId, breachAt }
```

---

## Authentication Architecture

### Flow
1. POST /api/auth/login → validate credentials → issue accessToken (15m) + refreshToken (7d)
2. refreshToken stored in HttpOnly Secure cookie
3. accessToken returned in response body → stored in Redux (memory only)
4. Every API request includes `Authorization: Bearer <accessToken>`
5. POST /api/auth/refresh → validates cookie refreshToken → issues new accessToken
6. POST /api/auth/logout → clears cookie + invalidates refreshToken in Redis

### JWT
- Access token: HS256, 15 minute TTL, payload: `{ sub, role, email }`
- Refresh token: HS256, 7 day TTL, payload: `{ sub, jti }` — jti stored in Redis for invalidation

---

## Authorization Architecture (RBAC)

### Roles
```
ADMIN     → Full system access: manage users, teams, settings, all incidents
MANAGER   → Manage team incidents, view all dashboards, assign incidents
ENGINEER  → Create/update own incidents, comment, view assigned incidents
VIEWER    → Read-only access to non-sensitive incidents
```

### Middleware Chain
1. `authenticate` — verifies JWT, attaches `req.user`
2. `authorize(...roles)` — checks `req.user.role` against allowed roles
3. `authorizeOwnerOrRole` — checks ownership for mutating own resources

### Server-side Enforcement
- Role is NEVER read from request body or query — always from verified JWT
- Every protected endpoint has explicit `authorize()` middleware
- Resource-level checks happen inside services (e.g., can assignee be changed by non-manager?)

---

## Notification Architecture

### In-App Notifications
- Created in DB (`Notification` model) by the notification service
- Published to Redis Pub/Sub channel `notification:{userId}`
- Socket.IO subscriber picks up from Pub/Sub and emits to `user:{userId}` room
- Frontend receives via Socket.IO and updates Redux notification slice + badge count

### Notification Triggers
- Incident assigned to you
- Incident you reported updated
- SLA breach on incident you own/are assigned to
- Comment added to incident you're subscribed to
- Incident escalated (priority changed to CRITICAL)

---

## File Attachment Architecture

### Upload Pipeline
1. Multer middleware: validates MIME type (image/*, application/pdf, text/plain) and size (≤ 10MB)
2. File written to `server/uploads/{incidentId}/{uuid}.{ext}` (dev) or S3 (prod)
3. `Attachment` record created in DB referencing file path
4. Audit log entry recorded

### Download
- GET /api/incidents/:id/attachments/:attachmentId/download
- Auth + ownership check before streaming file

---

## SLA Calculation Architecture

### SLA Policy
- Attached to incident at creation time based on priority
- CRITICAL: response 1h, resolution 4h
- HIGH:     response 4h, resolution 8h
- MEDIUM:   response 8h, resolution 24h
- LOW:      response 24h, resolution 72h

### Breach Detection
- `slaBreachAt` field set on incident at creation
- Cron job (`jobs/slaMonitor.js`) runs every minute
- Queries incidents WHERE `slaBreachAt <= NOW()` AND `status != RESOLVED`
- For each breached incident: updates `slaBreached = true`, creates Notification, publishes to Redis

### SLA Clock Pause
- SLA timer pauses when status changes to `ON_HOLD`
- `slaHoldStartedAt` stored; duration added to `slaBreachAt` on resume

---

## Audit Logging Architecture

### What is Logged
- Incident created, updated (field-level diff), deleted
- Assignment changes
- Status transitions
- Comment added / edited / deleted
- Attachment added / deleted
- User role changes (admin actions)

### Storage
- `AuditLog` table in PostgreSQL
- Written inside the same database transaction as the change
- Fields: `incidentId, actorId, action, fieldName, oldValue, newValue, createdAt`

### Immutability
- Audit logs are insert-only — no update or delete operations on this table

---

## API Architecture

### Base URL
`/api/v1`

### Endpoint Groups
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh

GET    /api/v1/incidents
POST   /api/v1/incidents
GET    /api/v1/incidents/:id
PATCH  /api/v1/incidents/:id
DELETE /api/v1/incidents/:id

GET    /api/v1/incidents/:id/comments
POST   /api/v1/incidents/:id/comments
PATCH  /api/v1/incidents/:id/comments/:commentId
DELETE /api/v1/incidents/:id/comments/:commentId

GET    /api/v1/incidents/:id/attachments
POST   /api/v1/incidents/:id/attachments
DELETE /api/v1/incidents/:id/attachments/:attachmentId
GET    /api/v1/incidents/:id/attachments/:attachmentId/download

GET    /api/v1/incidents/:id/audit

GET    /api/v1/users
GET    /api/v1/users/:id
PATCH  /api/v1/users/:id
DELETE /api/v1/users/:id

GET    /api/v1/teams
POST   /api/v1/teams
GET    /api/v1/teams/:id
PATCH  /api/v1/teams/:id
DELETE /api/v1/teams/:id
POST   /api/v1/teams/:id/members
DELETE /api/v1/teams/:id/members/:userId

GET    /api/v1/notifications
PATCH  /api/v1/notifications/:id/read
PATCH  /api/v1/notifications/read-all

GET    /api/v1/dashboard/stats
GET    /api/v1/dashboard/sla
GET    /api/v1/dashboard/workload
GET    /api/v1/dashboard/trends

GET    /api/v1/health
```

### Response Envelope
```json
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "pageSize": 20, "total": 150, "totalPages": 8 }
}
```

### Error Envelope
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": [ { "field": "email", "message": "Required" } ]
  }
}
```

---

## Testing Architecture

### Unit Tests (Jest)
- **Server**: Services and repositories tested in isolation with Prisma mocked
- **Client**: Redux slices, custom hooks, utility functions

### Integration Tests (Jest + Supertest)
- Express routes tested against a real test database (separate `TEST_DATABASE_URL`)
- Each test suite wraps in a transaction and rolls back

### Component Tests (React Testing Library)
- Each major component has a co-located `__tests__` directory
- Uses MSW (Mock Service Worker) to intercept RTK Query calls

### E2E Tests (Playwright)
- Full login → incident creation → assignment → resolution flow
- SLA breach notification flow
- Role-based access control flows

---

## Docker Architecture

### Services (docker-compose.yml)
```
postgres   → postgres:16-alpine, port 5432, named volume
redis      → redis:7-alpine, port 6379, named volume
server     → custom Dockerfile, port 5000, depends_on postgres + redis
client     → custom Dockerfile (nginx), port 3000, depends_on server
```

### Dockerfile Strategy
- **Server**: multi-stage — builder (installs deps, generates Prisma) + runtime (Node slim)
- **Client**: multi-stage — builder (Vite build) + runtime (nginx:alpine)

---

## Deployment Architecture

### Environment Tiers
- `development` — docker-compose with hot-reload volumes
- `staging` — docker-compose production build, `.env.staging`
- `production` — Kubernetes or Railway/Render, secrets from vault

### Environment Variables
- Never in source code
- `.env.example` in root, client/, server/ for documentation
- Real `.env` files in `.gitignore`

---

*Document generated during platform initialization — Prompt 1*
