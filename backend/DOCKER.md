# Backend Docker Setup

## Build image

```bash
docker build -t voting-backend:latest .
```

## Run backend container

```bash
docker run --name voting-backend \
  -p 8080:8080 \
  -e DB_URL=jdbc:mysql://host.docker.internal:3306/voting_app_db \
  -e DB_USERNAME=root \
  -e DB_PASSWORD=your_mysql_password \
  voting-backend:latest
```

## Run backend with MySQL in Docker

Create a `.env` file from `.env.example` or export the variables in your shell, then run:

```bash
docker compose up -d --build
```

Useful commands:

```bash
docker compose ps
docker compose logs -f backend
docker compose down
docker compose down -v
```
