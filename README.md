# polling-devops

This repository is the DevOps and GitOps layer for the polling application. Backend and frontend source code live in separate service repositories, while this repository owns Terraform, Kubernetes manifests, Argo CD configuration, monitoring references, and cleanup automation.

This repository now supports a microservices-style workflow for the polling application: each service repository has its own Jenkins CI/CD pipeline, images are pushed to Amazon ECR, this GitOps repository receives image tag updates, and Argo CD deploys the result to Kubernetes.

If you want to use Amazon EKS, treat it as a temporary demo environment and destroy it after testing. See [AWS_FREE_TIER_PLAN.md](D:/Harsha%20P/projects/devops/polling-devops/AWS_FREE_TIER_PLAN.md).

For the split-repository microservices flow, see [MICROSERVICES_CICD_RUNBOOK.md](D:/Harsha%20P/projects/devops/polling-devops/MICROSERVICES_CICD_RUNBOOK.md).

## What this repo does

- Runs the full polling stack with Docker Compose after service images are built separately
- Connects the frontend and backend containers on one shared Docker network
- Provides local observability with Prometheus and Grafana
- Includes SonarQube and Nexus for CI/CD work
- Includes a Jenkins validation pipeline for GitOps and infrastructure files
- Includes Kubernetes, Terraform, Argo CD, one-command EKS create/destroy scripts, and monitoring scaffolding

## Repository structure

```text
polling-devops/
|-- Jenkinsfile
|-- docker-compose.yml
|-- prometheus.yml
|-- .env.example
|-- README.md
|-- argocd/
|-- k8s/
|-- scripts/
|-- terraform/
`-- monitoring/
```

## Source layout

- Backend source lives in `https://github.com/Harsha2318/voting_app`
- Frontend source lives in `https://github.com/Harsha2318/Polling_Application`
- This repository contains deployment state only

## Prerequisites

- Docker Desktop or Docker Engine with Compose support
- Local clones of `voting_app` and `Polling_Application` when building service images locally
- Ports `80`, `3000`, `3306`, `8080`, `8081`, `8082`, `9000`, and `9090` available on your machine

## Build the backend image locally

From the backend service repository:

```powershell
cd "D:\Harsha P\projects\devops\voting_app"
docker build -t voting-backend:latest .
```

## Build the frontend image locally

From the frontend service repository:

```powershell
cd "D:\Harsha P\projects\devops\Polling_Application"
docker build -t voting-frontend:latest .
```

## Configure environment

From this repository:

```bash
copy .env.example .env
```

Then update `MYSQL_ROOT_PASSWORD` and any other values you want to change before starting the stack.

## Jenkins pipeline flow

The service Jenkinsfiles live in their own repositories:

- `voting_app/Jenkinsfile` builds, tests, scans, and publishes the backend image
- `Polling_Application/Jenkinsfile` builds, scans, and publishes the frontend image
- Both service pipelines update `k8s/kustomization.yml` in this repository
- This repository's `Jenkinsfile` validates Kustomize and Terraform only

Service pipeline order:

1. Check out one service repository
2. Build and test that service
3. Optionally run SonarQube analysis
4. Build that service's Docker image
5. Run Trivy image scan
6. Push the image to Amazon ECR
7. Update this repository's GitOps image tag
8. Let Argo CD sync the Kubernetes cluster

Expected Jenkins setup:

- Jenkins server packages:
  - Java 21 for Jenkins
  - Maven for the Spring Boot backend build
  - Node.js and npm for the Angular frontend build
  - Docker for image builds
  - AWS CLI for ECR login and push
  - Kustomize for GitOps image tag updates
  - Trivy for image scanning
- Jenkins plugins:
  - Pipeline
  - Git
  - JUnit
  - SonarQube Scanner
- Jenkins credentials:
  - `github-token` as username/password, where the password is a GitHub token with repository contents read/write access
- Optional Jenkins SonarQube server name:
  - `sonarqube-server`

The service Jenkinsfiles default `ENABLE_SONAR` to `false` so a first deployment can run without blocking on SonarQube setup. Enable it later after configuring the SonarQube server in Jenkins.

For AWS access, prefer an EC2 IAM role with ECR push permissions instead of storing AWS keys in Jenkins.

## ECR image push notes

The pipeline is now oriented around Amazon ECR for AWS deployment, for example:

- Backend image: `<account-id>.dkr.ecr.ap-south-1.amazonaws.com/polling-backend:<build-number>`
- Frontend image: `<account-id>.dkr.ecr.ap-south-1.amazonaws.com/polling-frontend:<build-number>`

The Terraform configuration creates the two ECR repositories used by this flow.

## Trivy scan

The pipeline runs Trivy against both built images and fails the build on `HIGH` or `CRITICAL` vulnerabilities.

Install Trivy on the Jenkins server or through the Ansible tooling playbook before using that stage.

## Kubernetes deployment with Argo CD on EKS

Kubernetes manifests are provided in the `k8s/` folder for:

- Namespace
- MySQL secret
- MySQL deployment and service
- Backend deployment and service
- Frontend deployment and service
- Ingress
- Kustomize image tag management

Argo CD manifests are provided in the `argocd/` folder for:

- `polling-project.yml`
- `polling-application.yml`

Recommended flow:

1. The backend and frontend Jenkins jobs build, scan, and push their own images to ECR.
2. Each service job updates its own image tag in `k8s/kustomization.yml` and pushes that commit.
3. Argo CD watches this repository and syncs the cluster automatically.

The namespace used for the application workloads is `polling-app`.

For this temporary EKS demo flow, MySQL is intentionally configured with ephemeral storage inside the cluster so the application can start without adding extra storage setup. That is acceptable for short-lived testing, but not for production data retention.

Example Argo CD install and bootstrap flow:

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl apply -f argocd/polling-project.yml
kubectl apply -f argocd/polling-application.yml
```

## Terraform AWS provisioning

The `terraform/` folder provisions:

- A VPC
- Two public subnets
- Internet gateway and routing
- Amazon EKS cluster
- Amazon EKS managed node group
- ECR repositories for backend and frontend images

This Terraform intentionally avoids NAT Gateway, RDS, and permanent load balancers so the cluster can be created for a short demo and destroyed immediately after.

Basic usage:

```bash
cd terraform
copy terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

For the full temporary-environment workflow:

```powershell
aws configure export-credentials --profile default --format powershell | Invoke-Expression
.\scripts\create-all.ps1
.\scripts\check-status.ps1
.\scripts\destroy-all.ps1
```

For a stricter future cleanup that also removes manually created Jenkins EC2 resources and checks common hidden AWS cost sources, use:

```powershell
.\scripts\destroy-aws-demo.ps1
.\scripts\destroy-aws-demo.ps1 -Execute
```

See [AWS_CLEANUP_RUNBOOK.md](D:/Harsha%20P/projects/devops/polling-devops/AWS_CLEANUP_RUNBOOK.md) for the full cleanup process and verification commands.

If you authenticate with `aws login`, export the credentials into the current PowerShell session before Terraform or EKS commands. The helper scripts now try to do this automatically, but doing it manually first is still the safest first-run flow.

## AWS cost guidance

If your goal is "use real EKS, but keep cost controlled", use this rule:

- Use Amazon EKS only temporarily
- Prefer 2 `t3.small` nodes for ordinary testing
- Move to 3 nodes only for the final demo
- Avoid NAT Gateway
- Avoid always-on AWS load balancers unless you accept the cost
- Destroy the cluster after testing

Why:

- Amazon EKS has a per-cluster hourly charge before worker-node cost is added.
- EKS also adds cost for worker nodes, EBS volumes, public IPv4 usage, and optional load balancers.
- Amazon ECR can still be used for a small image footprint while you test.

## Alternatives to Ansible

If you do not want Ansible, these are the strongest alternatives depending on what you want to automate:

- Argo CD: best fit for Kubernetes GitOps deployment and continuous reconciliation.
- Flux CD: strong GitOps alternative with bootstrap support and built-in image update automation.
- Crossplane: best when you want Kubernetes-style management of cloud infrastructure, not just app deployment.
- Tekton: best when you want Kubernetes-native CI pipelines instead of Jenkins-based CI.
- Helm only: acceptable if you want package-based Kubernetes releases without a full GitOps controller.

Recommended split for this repo:

- Terraform for AWS infrastructure
- Jenkins for build, test, scan, and image push
- Argo CD for Kubernetes deployment sync
- Prometheus and Grafana for monitoring

That keeps each tool focused on the layer it handles well.

## Monitoring

Monitoring resources are included in the `monitoring/` folder:

- `prometheus-values.yml` for a Helm-based Prometheus installation in Kubernetes
- `grafana-notes.md` with starter data source and dashboard guidance

## Run the full stack

```bash
docker compose up -d
```

Check container status:

```bash
docker compose ps
```

## Application and tool URLs

- Frontend: [http://localhost](http://localhost)
- Backend API: [http://localhost:8080/api/polls](http://localhost:8080/api/polls)
- Backend health: [http://localhost:8080/actuator/health](http://localhost:8080/actuator/health)
- Backend metrics: [http://localhost:8080/actuator/prometheus](http://localhost:8080/actuator/prometheus)
- Prometheus: [http://localhost:9090](http://localhost:9090)
- Grafana: [http://localhost:3000](http://localhost:3000)
- SonarQube: [http://localhost:9000](http://localhost:9000)
- Nexus: [http://localhost:8081](http://localhost:8081)
- Nexus Docker endpoint: `localhost:8082`

## Stop the stack

Stop containers:

```bash
docker compose down
```

Stop containers and remove named volumes:

```bash
docker compose down -v
```

## Notes

- The frontend is expected to use the backend through the `/api` relative path and its Nginx proxy setup.
- Prometheus scrapes the backend metrics endpoint at `/actuator/prometheus`.
- Real secrets are not committed in this repository. Use `.env` for local values.
- Kubernetes secrets and Terraform variable values should be replaced with environment-specific values before production use.
- The Jenkins pipeline assumes Linux-based Jenkins agents because the build steps use `sh`.
- If you fully move to Argo CD, the existing `ansible/` folder can be treated as legacy scaffolding and ignored.
- For cost control, keep heavy tools like Jenkins, SonarQube, and Nexus outside EKS and destroy the EKS environment when you are done.
