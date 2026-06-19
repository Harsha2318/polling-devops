# Grafana notes

## Recommended first data source

- Type: Prometheus
- URL: `http://prometheus-server`
- Access: Server

If you are running Grafana from Docker Compose instead of Helm, use:

- URL: `http://prometheus:9090`

## Useful first dashboards

- JVM Micrometer dashboard for Spring Boot metrics
- Node Exporter dashboard if you later add host metrics
- Kubernetes cluster monitoring dashboard after the app is deployed to the cluster

## Suggested first panels

- Application health status
- Request count and error rate
- JVM heap usage
- CPU usage
- Pod restarts

## Suggested alerts

- Backend health endpoint down
- High 5xx rate
- Pod restart count increasing
- JVM memory above threshold
- Disk usage above threshold on the server

