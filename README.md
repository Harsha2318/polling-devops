# polling-devops

This repository is the DevOps and GitOps layer for the polling application. Backend and frontend source code live in separate service repositories, while this repository owns Terraform, Kubernetes manifests, Argo CD configuration, monitoring references, and cleanup automation.

This repository now supports a microservices-style workflow for the polling application: Jenkins runs from this DevOps repository, temporarily clones the backend and frontend repositories, builds and pushes images to Amazon ECR, updates the GitOps image tags in this repository, and lets Argo CD deploy the result to Kubernetes.

If you want to use Amazon EKS, treat it as a temporary demo environment and destroy it after testing. See [AWS_FREE_TIER_PLAN.md](D:/Harsha%20P/projects/devops/polling-devops/AWS_FREE_TIER_PLAN.md).

For the exact Jenkins/ECR/EKS/Argo CD setup steps, follow [CI_CD_RUNBOOK.md](D:/Harsha%20P/projects/devops/polling-devops/CI_CD_RUNBOOK.md).

## What this repo does

- Runs the full polling stack with Docker Compose after service images are built separately
- Connects the frontend and backend containers on one shared Docker network
- Provides local observability with Prometheus and Grafana
- Includes SonarQube and Nexus for CI/CD work
- Includes a Jenkins CI/CD pipeline that builds the backend and frontend from their own repositories
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

The Jenkins job runs from this repository, but application source stays in the application repositories. Do not copy `backend/` or `frontend/` source folders into `polling-devops`.

Pipeline order:

1. Clean the Jenkins workspace.
2. Check out `Harsha2318/polling-devops`.
3. Validate `k8s/` with Kustomize and validate Terraform.
4. Clone `Harsha2318/voting_app` into `backend-src`.
5. Clone `Harsha2318/Polling_Application` into `frontend-src`.
6. Build and test backend with `mvn -B clean verify`.
7. Build frontend with `npm ci` and `npm run build`.
8. Optionally run SonarQube when `ENABLE_SONAR=true`.
9. Build Docker images from `backend-src` and `frontend-src`.
10. Tag both images as `<BUILD_NUMBER>-<backend-short-sha>-<frontend-short-sha>`.
11. Scan both images with Trivy.
12. Log in to Amazon ECR.
13. Push images to:
    - `140311410153.dkr.ecr.ap-south-1.amazonaws.com/polling-backend`
    - `140311410153.dkr.ecr.ap-south-1.amazonaws.com/polling-frontend`
14. Update only `k8s/kustomization.yml` with `kustomize edit set image`.
15. Commit and push that GitOps image-tag change to `polling-devops/main`.
16. Argo CD detects the Git change and syncs the `k8s/` path to EKS.

Expected Jenkins setup:

- Jenkins server packages:
  - Java 21 for Jenkins
  - Maven for the Spring Boot backend build
  - Node.js and npm for the Angular frontend build
  - Docker for image builds
  - AWS CLI for ECR login and push
  - Kustomize for GitOps image tag updates
  - Trivy for image scanning
  - Terraform for infrastructure validation
  - kubectl for Kustomize rendering through `kubectl kustomize`
- Jenkins plugins:
  - Pipeline
  - Git
  - JUnit
  - Credentials Binding
  - SonarQube Scanner
- Jenkins credentials:
  - `github-token` as username/password, where username is `Harsha2318` and password is a GitHub token with repository read access for all three repos and write access to `polling-devops`
- Optional Jenkins SonarQube server name:
  - `sonarqube-server`

The pipeline defaults `ENABLE_SONAR` to `false` so a first deployment can run without blocking on SonarQube setup. Enable it later after configuring the SonarQube server in Jenkins.

For AWS access, prefer an EC2 IAM role with ECR push permissions instead of storing AWS keys in Jenkins.

Jenkins job configuration:

```text
New Item: polling-devops-ci-cd
Type: Pipeline
Definition: Pipeline script from SCM
SCM: Git
Repository URL: https://github.com/Harsha2318/polling-devops.git
Branch: main
Script Path: Jenkinsfile
```

The job exposes these parameters:

- `ENABLE_SONAR`: optional SonarQube analysis.
- `BACKEND_BRANCH`: backend branch to clone, default `main`.
- `FRONTEND_BRANCH`: frontend branch to clone, default `main`.
- `BACKEND_REPO_URL`: backend repository URL, default `https://github.com/Harsha2318/voting_app.git`.
- `FRONTEND_REPO_URL`: frontend repository URL, default `https://github.com/Harsha2318/Polling_Application.git`.
- `GITOPS_REPO`: GitOps repository host/path for credentialed push, default `github.com/Harsha2318/polling-devops.git`.
- `GITOPS_BRANCH`: GitOps branch updated by Jenkins, default `main`.
- `AWS_REGION`: AWS region for ECR, default `ap-south-1`.
- `AWS_ACCOUNT_ID`: AWS account ID that owns the ECR repositories, default `140311410153`.
- `BACKEND_ECR_REPO`: backend ECR repository name, default `polling-backend`.
- `FRONTEND_ECR_REPO`: frontend ECR repository name, default `polling-frontend`.
- `TRIVY_SEVERITY`: comma-separated Trivy severities that fail the build, default `HIGH,CRITICAL`.

These values are Jenkins parameters with project defaults. Change them in the Jenkins build form when you deploy to another AWS account, region, repository, or branch.

Jenkins server setup commands for Ubuntu:

```bash
sudo apt update
sudo apt install -y git curl unzip wget gnupg lsb-release apt-transport-https maven openjdk-21-jdk docker.io
sudo usermod -aG docker jenkins
sudo systemctl restart docker
sudo systemctl restart jenkins

curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs

cd /tmp
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
unzip awscliv2.zip
sudo ./aws/install

wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | \
  gpg --dearmor | sudo tee /usr/share/keyrings/trivy.gpg > /dev/null
echo "deb [signed-by=/usr/share/keyrings/trivy.gpg] https://aquasecurity.github.io/trivy-repo/deb generic main" | \
  sudo tee /etc/apt/sources.list.d/trivy.list
sudo apt update
sudo apt install -y trivy

curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" | bash
sudo mv kustomize /usr/local/bin/

curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

sudo apt install -y gnupg software-properties-common
wget -O- https://apt.releases.hashicorp.com/gpg | \
  gpg --dearmor | sudo tee /usr/share/keyrings/hashicorp-archive-keyring.gpg > /dev/null
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | \
  sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update
sudo apt install -y terraform

java -version
mvn -version
node -v
npm -v
docker version
aws --version
trivy --version
kustomize version
kubectl version --client
terraform version
```

## ECR image push notes

The pipeline is oriented around Amazon ECR for AWS deployment. Image tags include the Jenkins build number and both app commit SHAs:

- Backend image: `140311410153.dkr.ecr.ap-south-1.amazonaws.com/polling-backend:<build-number>-<backend-sha>-<frontend-sha>`
- Frontend image: `140311410153.dkr.ecr.ap-south-1.amazonaws.com/polling-frontend:<build-number>-<backend-sha>-<frontend-sha>`

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

1. The `polling-devops-ci-cd` Jenkins job clones backend and frontend source from their own repositories.
2. Jenkins builds, scans, and pushes both images to ECR.
3. Jenkins updates both image tags in `k8s/kustomization.yml` and pushes the GitOps commit.
4. Argo CD watches this repository and syncs the cluster automatically.

The namespace used for the application workloads is `polling-app`.

For this temporary EKS demo flow, MySQL is intentionally configured with ephemeral storage inside the cluster so the application can start without adding extra storage setup. That is acceptable for short-lived testing, but not for production data retention.

Example Argo CD install and bootstrap flow:

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl apply -f argocd/polling-project.yml
kubectl apply -f argocd/polling-application.yml
```

Verification commands:

```bash
docker images | grep polling
aws ecr describe-repositories --repository-names polling-backend polling-frontend --region ap-south-1
aws ecr list-images --repository-name polling-backend --region ap-south-1
aws ecr list-images --repository-name polling-frontend --region ap-south-1
kubectl get pods -n polling-app
kubectl get svc -n polling-app
kubectl get ingress -n polling-app
argocd app get polling-app
argocd app sync polling-app
```

Troubleshooting:

- Maven failure: confirm Jenkins uses Java 21 with `java -version`, then rerun `mvn -B clean verify` inside `backend-src` and inspect `target/surefire-reports`.
- npm failure: confirm Node.js 24 or a compatible version with `node -v`, remove stale dependencies in the Jenkins workspace, and rerun `npm ci` inside `frontend-src`.
- Docker permission denied: add Jenkins to the Docker group with `sudo usermod -aG docker jenkins`, then restart Docker and Jenkins.
- ECR login failure: verify the Jenkins EC2 IAM role with `aws sts get-caller-identity` and confirm ECR push permissions for `polling-backend` and `polling-frontend`.
- Trivy scan failure: read archived `trivy-report.txt`; either update the base image/dependencies or temporarily adjust severity only for a known accepted risk.
- Git push failure: check that Jenkins credential `github-token` has contents read/write permission on `polling-devops`, then rerun after pulling/rebasing if `main` moved.
- Argo CD sync issue: run `argocd app get polling-app`, check the application events, and confirm `argocd/polling-application.yml` points to repo `https://github.com/Harsha2318/polling-devops.git`, revision `main`, path `k8s`.
- ImagePullBackOff: verify the image tag in `k8s/kustomization.yml` exists in ECR and that EKS worker nodes can pull from ECR.
- CrashLoopBackOff: inspect `kubectl logs -n polling-app deploy/voting-backend` or `deploy/voting-frontend`, then describe the pod for probe failures.
- MySQL connection failure: verify `mysql` service endpoints, `mysql-secret`, `DB_URL=jdbc:mysql://mysql:3306/voting_app_db`, and backend logs.

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
