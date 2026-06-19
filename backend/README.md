# Voting Backend

Spring Boot backend for the voting application.

## Tech Stack

- Java 21
- Spring Boot 3.5.15
- Maven
- MySQL
- Docker
- Docker Compose

## API Endpoints

- `POST /api/polls`
- `GET /api/polls`
- `GET /api/polls/{id}`
- `POST /api/polls/vote`
- `GET /actuator/health`
- `GET /actuator/prometheus`

## Environment Variables

The application reads database config from environment variables:

- `DB_URL`
- `DB_USERNAME`
- `DB_PASSWORD`

For Docker Compose, the backend connects to `jdbc:mysql://mysql:3306/voting_app_db`.
For local IDE runs, use `jdbc:mysql://localhost:3306/voting_app_db`.

## Run with Maven

```bash
mvn clean test
mvn clean package
mvn spring-boot:run
```

## Run with Docker

Build the image:

```bash
docker build -t voting-backend:latest .
```

Run against local MySQL:

```bash
docker run --name voting-backend \
  -p 8080:8080 \
  -e DB_URL=jdbc:mysql://host.docker.internal:3306/voting_app_db \
  -e DB_USERNAME=root \
  -e DB_PASSWORD=your_mysql_password \
  voting-backend:latest
```

## Run with Docker Compose

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f backend
docker compose down
docker compose down -v
```

## Health Checks

- `http://localhost:8080/actuator/health`
- `http://localhost:8080/actuator/prometheus`

## Notes

- This repository intentionally contains only backend code and backend Docker assets.
- Frontend and DevOps/infrastructure live in separate repositories.
