# Polling DevOps Project Implementation Guide

> This document is historical for the original single-repository milestone. The current implementation is split into service repositories and a GitOps repository. Use [MICROSERVICES_CICD_RUNBOOK.md](D:/Harsha%20P/projects/devops/polling-devops/MICROSERVICES_CICD_RUNBOOK.md) for the active process.

This document explains the complete DevOps implementation for the polling application: what was built, how the pieces connect, how to run it locally, how to deploy it to AWS EKS through Jenkins and Argo CD, how to verify it, and how to clean everything up to avoid AWS cost.

## Current Status

The repository implementation is complete and pushed to GitHub:

```text
Repository: https://github.com/Harsha2318/polling-devops.git
Branch: main
```

The AWS demo environment is currently destroyed to avoid cost. That means there is no live EKS cluster, Jenkins EC2 instance, ECR repository, VPC, EBS volume, NAT gateway, or load balancer running for this project right now.

Use this document when you want to recreate the demo later.

## Project Goal

The goal of this project is to demonstrate an industry-style DevOps workflow for a full-stack polling application using:

```text
Spring Boot + Angular + MySQL + Maven + Jenkins + Docker + Trivy + Kubernetes + GitHub + AWS ECR + AWS EKS + Argo CD + Prometheus/Grafana
```

The final CI/CD design is:

```text
Developer pushes code to GitHub
        |
        v
Jenkins pipeline starts
        |
        v
Jenkins builds backend and frontend
        |
        v
Jenkins builds Docker images
        |
        v
Jenkins scans images with Trivy
        |
        v
Jenkins pushes images to AWS ECR
        |
        v
Jenkins updates k8s/kustomization.yml image tags
        |
        v
Jenkins pushes GitOps manifest update to GitHub
        |
        v
Argo CD detects Git change
        |
        v
Argo CD deploys to AWS EKS
```

Jenkins handles CI and image publishing. Argo CD handles Kubernetes deployment.

## Repository Layout

```text
polling-devops/
|-- Jenkinsfile
|-- README.md
|-- PROJECT_IMPLEMENTATION_GUIDE.md
|-- AWS_CLEANUP_RUNBOOK.md
|-- docker-compose.yml
|-- docker-compose.prod.yml
|-- prometheus.yml
|-- backend/
|-- frontend/
|-- k8s/
|-- argocd/
|-- terraform/
|-- scripts/
|-- monitoring/
`-- ansible/
```

Important folders:

- `backend/`: Spring Boot backend source, Maven project, backend Dockerfile.
- `frontend/`: Angular frontend source, npm project, frontend Dockerfile.
- `k8s/`: Kubernetes manifests and Kustomize image mapping.
- `argocd/`: Argo CD project and application manifests.
- `terraform/`: AWS EKS, ECR, VPC, IAM, and node group infrastructure.
- `scripts/`: PowerShell helpers for create, deploy, status, destroy, and full cleanup.
- `monitoring/`: Prometheus/Grafana reference files.
- `ansible/`: Legacy scaffolding. Current direction is Argo CD instead of Ansible.

## What Was Implemented

### 1. Single Repository Source Layout

Backend and frontend source code were brought into this repository:

```text
backend/
frontend/
```

This allows Jenkins to build directly from one GitHub repository instead of cloning separate backend and frontend repositories.

### 2. Jenkins Pipeline

The pipeline is implemented in:

```text
Jenkinsfile
```

Main stages:

```text
Checkout
Backend Build and Test
Frontend Build
Optional SonarQube Analysis
Optional Quality Gate
Build Docker Images
Trivy Scan
Login To ECR
Push Images To ECR
Update GitOps Manifests
```

Important behavior:

- Backend runs `mvn clean verify`.
- Frontend runs `npm ci` and `npm run build`.
- SonarQube is controlled by `ENABLE_SONAR`, defaulting to `false`.
- Docker images are tagged with Jenkins `BUILD_NUMBER`.
- ECR image URLs use account `140311410153` and region `ap-south-1`.
- GitOps updates are made with `kustomize edit set image`.
- Jenkins pushes updated `k8s/kustomization.yml` back to GitHub.

### 3. Kubernetes Manifests

Kubernetes resources are in:

```text
k8s/
```

Resources include:

- Namespace: `polling-app`
- MySQL secret
- MySQL deployment and service
- Backend deployment and service
- Frontend deployment and service
- Ingress
- Kustomize image overrides

For temporary EKS demos, MySQL uses ephemeral storage. This avoids adding EBS/PVC complexity and cost for a short-lived demo.

### 4. Argo CD GitOps

Argo CD manifests are in:

```text
argocd/polling-project.yml
argocd/polling-application.yml
```

The Argo CD application watches:

```text
Repo: https://github.com/Harsha2318/polling-devops.git
Branch: main
Path: k8s
Namespace: polling-app
```

Argo CD syncs Kubernetes from Git, not from direct Jenkins `kubectl apply`.

### 5. Terraform AWS Provisioning

Terraform is in:

```text
terraform/
```

It provisions:

- VPC
- Two public subnets
- Internet gateway
- Route table
- EKS cluster
- EKS managed node group
- IAM roles for EKS
- ECR repositories:
  - `polling-backend`
  - `polling-frontend`

It intentionally avoids:

- NAT Gateway
- RDS
- Permanent AWS load balancers

This keeps the demo cheaper and easier to destroy.

### 6. Cleanup Automation

Cleanup is documented in:

```text
AWS_CLEANUP_RUNBOOK.md
```

Cleanup automation is implemented in:

```text
scripts/destroy-aws-demo.ps1
```

The script supports dry-run by default:

```powershell
.\scripts\destroy-aws-demo.ps1
```

Actual cleanup:

```powershell
.\scripts\destroy-aws-demo.ps1 -Execute
```

It checks and removes project resources such as EKS, EC2, ECR, IAM roles, security groups, VPC, EBS volumes, Elastic IPs, load balancers, and NAT gateways.

## Local Development Flow

Use this when you only want to run the stack on your machine with Docker Compose.

### 1. Start Docker Desktop

Make sure Docker Desktop is running.

### 2. Build Images

```powershell
cd "D:\Harsha P\projects\devops\polling-devops"

cd backend
docker build -t voting-backend:latest .

cd ..\frontend
docker build -t voting-frontend:latest .
```

### 3. Start Local Stack

```powershell
cd "D:\Harsha P\projects\devops\polling-devops"
docker compose up -d
```

### 4. Check Containers

```powershell
docker compose ps
```

Expected services:

- `frontend`
- `backend`
- `mysql`
- `prometheus`
- `grafana`
- `sonarqube`
- `nexus`

### 5. Local URLs

```text
Frontend:       http://localhost
Backend API:    http://localhost:8080/api/polls
Backend health: http://localhost:8080/actuator/health
Prometheus:     http://localhost:9090
Grafana:        http://localhost:3000
SonarQube:      http://localhost:9000
Nexus:          http://localhost:8081
```

## AWS EKS Deployment Flow

Use this only when you are ready to create real AWS resources. EKS creates cost while running.

### 1. Login to AWS

```powershell
aws login
aws sts get-caller-identity
```

Expected account:

```text
140311410153
```

Export credentials for Terraform:

```powershell
aws configure export-credentials --profile default --format powershell | Invoke-Expression
$env:AWS_REGION="ap-south-1"
$env:AWS_DEFAULT_REGION="ap-south-1"
```

### 2. Create AWS Infrastructure

```powershell
cd "D:\Harsha P\projects\devops\polling-devops\terraform"
terraform init
terraform plan
terraform apply
```

When asked:

```text
Do you want to perform these actions?
```

Type:

```text
yes
```

### 3. Configure kubectl

```powershell
aws eks update-kubeconfig --region ap-south-1 --name polling-eks
kubectl get nodes -o wide
```

Expected:

```text
2 nodes Ready
```

### 4. Install Argo CD

```powershell
cd "D:\Harsha P\projects\devops\polling-devops"
.\scripts\deploy-argocd.ps1
```

Check:

```powershell
kubectl get pods -n argocd
kubectl get applications -n argocd
```

Expected Argo CD pods should be `Running`.

### 5. First Expected App State

Before Jenkins pushes images to ECR, frontend/backend pods may show:

```text
ImagePullBackOff
```

That is expected if ECR does not yet contain backend/frontend images.

Jenkins fixes this by building and pushing the images.

## Jenkins EC2 Setup

Recommended Jenkins server:

```text
AMI: Amazon Linux or Ubuntu
Instance type: Free-tier eligible for practice, larger for smooth real builds
Disk: 20 GB or more
Ports: 8080 for Jenkins
```

Required packages on Jenkins:

```text
Java 21
Git
Docker
Maven
Node.js
npm
AWS CLI
Kustomize
Trivy
```

Required Jenkins plugins:

```text
Pipeline
Git
JUnit
Credentials Binding
SonarQube Scanner optional
```

Required Jenkins credential:

```text
ID: github-token
Kind: Username with password
Username: Harsha2318
Password: GitHub token with repository contents read/write access
```

Required AWS permission:

Use an EC2 IAM role instead of storing AWS keys in Jenkins.

The role needs:

- `ecr:GetAuthorizationToken`
- `ecr:BatchCheckLayerAvailability`
- `ecr:BatchGetImage`
- `ecr:CompleteLayerUpload`
- `ecr:DescribeRepositories`
- `ecr:InitiateLayerUpload`
- `ecr:PutImage`
- `ecr:UploadLayerPart`

Scope ECR repository permissions to:

```text
arn:aws:ecr:ap-south-1:140311410153:repository/polling-backend
arn:aws:ecr:ap-south-1:140311410153:repository/polling-frontend
```

## Jenkins Job Setup

Create a pipeline job:

```text
Name: polling-devops-ci-cd
Type: Pipeline
Definition: Pipeline script from SCM
SCM: Git
Repository URL: https://github.com/Harsha2318/polling-devops.git
Branch: main
Script Path: Jenkinsfile
```

For first run:

```text
ENABLE_SONAR=false
```

Enable Sonar later only after Jenkins has a configured SonarQube server named:

```text
sonarqube-server
```

## What Happens After Jenkins Succeeds

Jenkins pushes images like:

```text
140311410153.dkr.ecr.ap-south-1.amazonaws.com/polling-backend:1
140311410153.dkr.ecr.ap-south-1.amazonaws.com/polling-frontend:1
```

Then it updates:

```text
k8s/kustomization.yml
```

Example result:

```yaml
images:
  - name: voting-backend
    newName: 140311410153.dkr.ecr.ap-south-1.amazonaws.com/polling-backend
    newTag: "1"
  - name: voting-frontend
    newName: 140311410153.dkr.ecr.ap-south-1.amazonaws.com/polling-frontend
    newTag: "1"
```

Argo CD sees that Git commit and syncs the app into EKS.

## Verification Commands

### Jenkins Build

In Jenkins, check:

```text
polling-devops-ci-cd
Build Console Output
```

Expected stages:

```text
Checkout
Backend Build and Test
Frontend Build
Build Docker Images
Trivy Scan
Login To ECR
Push Images To ECR
Update GitOps Manifests
```

### ECR

```powershell
aws ecr list-images --repository-name polling-backend --region ap-south-1
aws ecr list-images --repository-name polling-frontend --region ap-south-1
```

Expected:

```text
At least one image tag in each repository
```

### Argo CD

```powershell
kubectl get applications -n argocd
kubectl describe application polling-app -n argocd
```

Expected:

```text
polling-app   Synced   Healthy
```

### Kubernetes Pods

```powershell
kubectl get pods -n polling-app
```

Expected:

```text
mysql             Running
voting-backend    Running
voting-frontend   Running
```

### Kubernetes Services

```powershell
kubectl get svc -n polling-app
```

Expected:

```text
mysql
voting-backend
voting-frontend
```

### Access Frontend

```powershell
kubectl port-forward svc/voting-frontend -n polling-app 8088:80
```

Open:

```text
http://localhost:8088
```

### Access Backend

```powershell
kubectl port-forward svc/voting-backend -n polling-app 8080:8080
```

Open:

```text
http://localhost:8080/actuator/health
http://localhost:8080/api/polls
```

## Common Issues and Fixes

### Terraform Cannot Read AWS Credentials

Error:

```text
No valid credential sources found
```

Fix:

```powershell
aws configure export-credentials --profile default --format powershell | Invoke-Expression
$env:AWS_REGION="ap-south-1"
$env:AWS_DEFAULT_REGION="ap-south-1"
```

Then rerun:

```powershell
terraform plan
```

### kubectl Tries localhost

Error:

```text
Unable to connect to the server: dial tcp 127.0.0.1
```

Cause:

```text
kubectl is pointing to an old local cluster context.
```

Fix:

```powershell
aws eks update-kubeconfig --region ap-south-1 --name polling-eks
kubectl get nodes
```

### ImagePullBackOff

Cause:

```text
EKS cannot find the image tag in ECR.
```

Check:

```powershell
aws ecr list-images --repository-name polling-backend --region ap-south-1
aws ecr list-images --repository-name polling-frontend --region ap-south-1
```

Fix:

```text
Run Jenkins successfully so images are pushed and k8s/kustomization.yml is updated.
```

### Jenkins Requires Java 21

Current Jenkins LTS may require Java 21.

Check:

```bash
java -version
```

Expected:

```text
openjdk version "21..."
```

### Jenkins Cannot Push GitOps Commit

Check:

```text
Credential ID: github-token
Permission: repository contents read/write
```

The Jenkinsfile expects:

```groovy
credentialsId: 'github-token'
```

## Cleanup Process

Always destroy AWS resources after demo/testing.

### Preview Cleanup

```powershell
cd "D:\Harsha P\projects\devops\polling-devops"
.\scripts\destroy-aws-demo.ps1
```

### Execute Cleanup

```powershell
.\scripts\destroy-aws-demo.ps1 -Execute
```

### Verify Cleanup

```powershell
.\scripts\destroy-aws-demo.ps1
```

Expected:

```text
No matching EC2 instances found.
ECR repository not found: polling-backend
ECR repository not found: polling-frontend
Project VPC not found.
No EKS clusters.
No EBS volumes.
No Elastic IP addresses.
No load balancers.
No NAT gateways.
```

## Current Cleanup Result

The latest cleanup removed:

- Jenkins EC2
- Old stopped Jenkins/slave EC2 instances
- EKS cluster
- ECR repositories
- EBS volumes
- VPC
- Jenkins IAM role and instance profile
- EKS IAM roles
- Security groups
- Terraform state entries

Final dry-run showed no remaining AWS project resources.

If AWS CLI says the session expired, run:

```powershell
aws login
.\scripts\destroy-aws-demo.ps1
```

## Interview Explanation

Use this explanation:

```text
I implemented a Jenkins-based CI/CD and Argo CD GitOps workflow for a full-stack polling application. The backend is built with Spring Boot and Maven, the frontend is built with Angular and npm, and both services are containerized with Docker. Jenkins runs the CI pipeline, builds and scans images with Trivy, pushes them to AWS ECR, and updates Kubernetes image tags in the GitOps manifests. Argo CD watches the GitHub repository and syncs those manifests to AWS EKS. Terraform provisions the temporary AWS infrastructure, and a cleanup script removes EKS, EC2, ECR, VPC, IAM, EBS, load balancers, and other cost-related resources after the demo.
```

## Short Resume Version

```text
Built a Jenkins CI/CD and Argo CD GitOps pipeline for a Spring Boot and Angular polling app using Docker, AWS ECR, AWS EKS, Terraform, Kubernetes, Trivy, Prometheus, and Grafana, with automated AWS cleanup to control cloud cost.
```

## Important Cost Reminder

EKS creates cost while running. EC2 can create cost through compute and EBS volumes. Load balancers, NAT gateways, Elastic IPs, and ECR image storage can also create cost.

For practice:

```text
Create AWS resources only when needed.
Run the demo.
Verify the result.
Destroy immediately.
Run cleanup dry-run again.
```
