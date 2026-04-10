# AI Workflow Builder

A full-stack application for building and running AI agent workflows via a visual drag-and-drop editor

## Architecture

| Layer     | Tech                                   |
| --------- | -------------------------------------- |
| Frontend  | React 19 · TypeScript · Vite · Tailwind CSS · shadcn/ui · React Flow · Zustand · Recharts |
| Backend   | Node.js · Express · TypeScript · Prisma ORM + postgressql · Zod · JWT |
| API-test  | Swagger UI && openAPI                     |
| Database  | PostgreSQL 16                          |
| Real-time | Server-Sent Events (SSE)               |
| Email     | Nodemailer → MailHog (dev)              |
| Infra     | Docker Compose (4 services)            |

## Getting Started

### Prerequisites

- Docker & Docker Compose **OR** Node.js ≥ 20, PostgreSQL 16
- Git

### Quick Start (Docker)

```bash
# Clone & configure
cp .env.example .env

# Start all services (postgres, mailhog, backend, frontend)
docker-compose up --build
```

| Service   | URL                         |
| --------- | --------------------------- |
| Frontend  | http://localhost:3000          |
| Backend   | http://localhost:3001/api     |
| Swagger UI	http://localhost:3001/api/docs  |
| OpenAPI JSON	http://localhost:3001/api/docs.json |
| MailHog   | http://localhost:8025         |

### Local Development (no Docker)

```bash
# 1. Backend
cd backend
npm install
npx prisma generate
npx prisma db push          # requires running PostgreSQL
npx prisma db seed
npm run dev                  # → http://localhost:3001

# 2. Frontend
cd frontend
npm install
npm run dev                  # → http://localhost:5173
```

## Test Accounts

| Email           | Password | Role  |
| --------------- | -------- | ----- |
| admin@test.com  | admin123 | ADMIN |
| user@test.com   | user123  | USER  |

Admin users can create, edit, and delete agents. Regular users can view agents, manage workflows, and run them.

## Project Structure

```
├── docker-compose.yml
├── .env / .env.example
├── backend/
│   ├── prisma/schema.prisma       # Database models & enums
│   ├── src/
│   │   ├── index.ts               # Express entry point
│   │   ├── config/                # App config & Prisma client
│   │   ├── middleware/            # Auth, CORS, error handler, correlation ID
│   │   ├── routes/                # REST route definitions
│   │   ├── controllers/           # Request handlers (auth, agents, workflows, runs, kpis)
│   │   ├── services/              # Business logic (execution engine, agent runner, email, SSE)
│   │   ├── utils/                 # Logger
│   │   └── __tests__/             # Vitest unit tests
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx                # Router & route definitions
│   │   ├── components/
│   │   │   ├── ui/                # Reusable UI primitives (Button, Card, Badge, Dialog, …)
│   │   │   └── layout/            # MainLayout, ProtectedRoute
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx      # KPI charts & workflow overview
│   │   │   ├── AgentLibrary.tsx   # Agent CRUD with search/filter
│   │   │   ├── WorkflowList.tsx   # Workflow list
│   │   │   ├── WorkflowEditor.tsx # Drag-and-drop React Flow canvas
│   │   │   └── Playground.tsx     # Run execution with real-time SSE logs
│   │   ├── services/api.ts        # Axios client with JWT interceptor
│   │   ├── stores/authStore.ts    # Zustand auth state
│   │   ├── lib/                   # Types, utilities
│   │   └── __tests__/             # Vitest + Testing Library tests
│   ├── nginx.conf
│   └── Dockerfile
```

## Key Features

### 1. Agent Library
- Full CRUD for AI agents (admin-only create/update/delete)
- Each agent has: name, family, version, JSON input/output schemas, endpoint URL, tags
- Search, filter by family/status, sort by name/date
- Secrets are masked in API responses

### 2. Visual Workflow Editor
- Drag-and-drop agent nodes from a searchable palette onto a React Flow canvas
- Connect nodes with edges to define execution order
- Real-time cycle detection prevents invalid DAG configurations
- Per-node configuration: error policy (STOP/CONTINUE), max retries, backoff, input/output mapping
- Workflow validation and version tracking

### 3. Execution Engine (Playground)
- Topological sort of workflow DAG into parallelizable levels
- Nodes in the same level run concurrently
- Input mapping: `{{prompt}}` for user input, `{{node-id.field}}` for previous node outputs
- Retry logic with exponential backoff
- Error policies: STOP (halt on failure) or CONTINUE (skip and proceed)
- Real-time SSE streaming of step progress, logs, and completion

### 4. Dashboard & KPIs
- Total runs, success rate, average duration, P95 latency
- Pie chart of run outcomes (SUCCESS/FAILED)
- Bar chart of top agents by usage
- Duration distribution histogram
- Workflow table with search and status filters

### 5. Authentication & Authorization
- JWT-based authentication (24h token expiry)
- Role-based access control (ADMIN / USER)
- Protected routes with automatic redirect

## API Endpoints

| Method | Path                        | Auth | Description                     |
| ------ | --------------------------- | ---- | ------------------------------- |
| POST   | /api/auth/register          | No   | Register new user               |
| POST   | /api/auth/login             | No   | Login, get JWT                  |
| GET    | /api/auth/me                | Yes  | Current user profile            |
| GET    | /api/agents                 | Yes  | List agents (search/filter)     |
| POST   | /api/agents                 | Admin| Create agent                    |
| GET    | /api/agents/:id             | Yes  | Get agent by ID                 |
| PUT    | /api/agents/:id             | Admin| Update agent                    |
| DELETE | /api/agents/:id             | Admin| Delete agent                    |
| GET    | /api/workflows              | Yes  | List user's workflows           |
| POST   | /api/workflows              | Yes  | Create workflow                 |
| GET    | /api/workflows/:id          | Yes  | Get workflow by ID              |
| PUT    | /api/workflows/:id          | Yes  | Update workflow                 |
| DELETE | /api/workflows/:id          | Yes  | Delete workflow                 |
| POST   | /api/workflows/:id/validate | Yes  | Validate workflow DAG           |
| POST   | /api/runs                   | Yes  | Start a workflow run            |
| GET    | /api/runs/:id               | Yes  | Get run with steps              |
| GET    | /api/runs                   | Yes  | List runs (paginated)           |
| GET    | /api/runs/:id/stream        | Yes  | SSE stream of run progress      |
| GET    | /api/kpis                   | Yes  | Aggregated KPI data             |

## Running Tests

```bash
# Backend tests (22 tests)
cd backend && npm test

# Frontend tests (11 tests)
cd frontend && npm test
```

## Environment Variables

See `.env.example` for all configuration options:

- `DATABASE_URL` – PostgreSQL connection string
- `JWT_SECRET` – Secret for signing JWT tokens
- `PORT` – Backend server port (default: 3001)
- `CORS_ORIGIN` – Allowed CORS origin
- `SMTP_HOST`, `SMTP_PORT` – Mail server (MailHog in dev)
- `SMTP_FROM` – Sender email address

## Email Notifications

When a workflow run completes, an HTML email is sent with:
- Run status (SUCCESS / FAILED)
- Duration
- Per-step detail table with color-coded statuses
- Error details (if any)

In development, emails are captured by MailHog at http://localhost:8025.
