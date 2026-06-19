# Polling Application Frontend

Angular frontend for the Spring Boot voting application. This repository stays frontend-only and communicates with the backend through relative `/api` paths so it works both in local Angular development and inside Docker with Nginx proxying.

## Frontend Overview

- Framework: Angular 21 with standalone components
- Purpose: dashboard, poll discovery, poll creation, voting, live result tracking, and poll management
- Backend repository: `Harsha2318/voting_app`
- API base path used in Angular: `/api/polls`

## Backend API Dependency

This frontend is built for the polling backend APIs below:

- `GET /api/polls`
- `GET /api/polls?search=devops&sort=mostVotes&status=ACTIVE`
- `GET /api/polls/{id}`
- `POST /api/polls`
- `POST /api/polls/{id}/vote`
- `PATCH /api/polls/{id}/close`
- `DELETE /api/polls/{id}`
- `GET /api/polls/stats`

The frontend also includes response normalization so it can still render older poll payloads while the backend catches up.

## Features

- Dashboard with summary cards and active poll highlights
- Poll listing with search, sort, filter, refresh, empty state, loading state, and error state
- Create poll form with dynamic options
- Validation for required question, minimum question length, empty options, duplicate options, and option count limits
- Poll details page with vote, refresh, close poll, and delete poll actions
- Result percentages, total vote counts, winner badge, and poll status badge
- Browser-level duplicate vote prevention with `localStorage`
- Docker-ready Nginx setup for SPA routing and backend proxying

## Available Routes

- `/dashboard`
- `/polls`
- `/create`
- `/polls/:id`

Default and wildcard routes redirect to `/polls`.

## Local Development

Start the backend first in the backend repository so the Angular dev proxy has a running API target:

```bash
mvn spring-boot:run
```

Then run the frontend in this repository:

```bash
npm install
npm start
```

Open [http://localhost:4200](http://localhost:4200).

Backend should be available at [http://localhost:8080](http://localhost:8080).

## Proxy Explanation

Angular services use only relative API paths such as:

- `/api/polls`
- `/api/polls/1`
- `/api/polls/1/vote`

For local development, [proxy.conf.json](D:/Harsha%20P/projects/devops/Polling_Application/proxy.conf.json) forwards `/api` traffic to `http://localhost:8080`, which avoids hardcoding backend URLs in the UI.

## Build

```bash
npm run build
```

Angular production output is generated in `dist/poll-app`, with browser assets inside `dist/poll-app/browser`.

## Docker

Build the frontend image:

```bash
docker build -t voting-frontend:latest .
```

Run the frontend container:

```bash
docker run --rm -p 80:80 voting-frontend:latest
```

The container uses [nginx.conf](D:/Harsha%20P/projects/devops/Polling_Application/nginx.conf) to:

- serve the Angular app
- support SPA routing with `try_files`
- proxy `/api/` requests to `http://voting-backend:8080/api/`

## Interview Explanation

> I built the Angular frontend using a clean component-based architecture. It includes a dashboard, poll listing, poll creation, poll details, voting, result percentages, winner badges, search, sorting, filtering, loading states, and error handling. The frontend uses relative `/api` paths, so it works locally with Angular proxy configuration and in Docker with Nginx reverse proxy. I also added browser-level duplicate vote prevention using localStorage for the demo flow. In production, duplicate voting should be enforced by backend authentication and voter records.

## Repo Boundaries

- Frontend code belongs in this repository only.
- Spring Boot backend code belongs in `Harsha2318/voting_app`.
- Jenkins, Docker Compose, Kubernetes, Terraform, Ansible, and monitoring should live in the separate `polling-devops` repository.
