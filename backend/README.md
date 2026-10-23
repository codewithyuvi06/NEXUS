# NEXUS Backend

Express + TypeScript + MongoDB API for the NEXUS productivity frontend.

## Requirements
- Node.js 20+
- MongoDB Community running locally, or a MongoDB Atlas connection string

## Setup
```bash
cd nexus-backend
npm install
cp .env.example .env
```
Set `MONGODB_URI`, `JWT_SECRET` (at least 32 random characters for production), and `CLIENT_ORIGIN` in `.env`. Start MongoDB, then run:
```bash
npm run dev
```
API: `http://localhost:4000/api`; health check: `GET /api/health`.

## Authentication
- `POST /api/auth/register` `{ "name": "Alex Morgan", "email": "alex@example.com", "password": "at-least-8-chars" }`
- `POST /api/auth/login` `{ "email": "alex@example.com", "password": "at-least-8-chars" }`
- `GET /api/auth/me` with `Authorization: Bearer <token>`
- `GET /api/users/me`, `PATCH /api/users/me`

Registration/login return `{ token, user }`. Store tokens with a deployment-appropriate strategy; this starter currently uses bearer JWTs.

## Resource API
All resource routes require a bearer token. Supported kinds: `task`, `project`, `goal`, `habit`, `note`, `focus-session`, `notification`, `event`.

- `GET /api/resources/:kind`
- `POST /api/resources/:kind` with the resource fields in the JSON body
- `GET /api/resources/:kind/:id`
- `PATCH /api/resources/:kind/:id`
- `DELETE /api/resources/:kind/:id` (soft delete)

Example:
```bash
curl http://localhost:4000/api/resources/task -H "Authorization: Bearer YOUR_TOKEN"
```

Each record is scoped to its owner. Resource payloads are flexible to match the existing frontend types; add domain-specific validation as the product requirements settle.

## Analytics
`GET /api/analytics` returns task completion and focus-session summaries based on saved records.

## Frontend connection
In the frontend root `.env`, set:
```env
VITE_API_BASE_URL=http://localhost:4000/api
```
The provided frontend currently uses `localStorage` for most CRUD actions. The API is implemented, but those UI mutations are not automatically server-backed yet; wire `src/services/api.ts` into the components to enable sync. This avoids silently changing the existing UI behaviour.
