# Microservices CI/CD Runbook

This project is split into three repositories:

```text
voting_app/              Spring Boot backend service
Polling_Application/     Angular frontend service
polling-devops/          Terraform, Kubernetes, Argo CD, monitoring, and cleanup scripts
```

Each service has its own Jenkins pipeline. The DevOps repository is the GitOps source of truth watched by Argo CD.

## End-to-End Flow

Backend change:

```text
Push to voting_app
Jenkins backend job runs
Maven build and tests pass
Backend Docker image is built and scanned
Image is pushed to ECR polling-backend
Jenkins updates k8s/kustomization.yml in polling-devops
Argo CD syncs the backend deployment in EKS
```

Frontend change:

```text
Push to Polling_Application
Jenkins frontend job runs
npm ci and Angular build pass
Frontend Docker image is built and scanned
Image is pushed to ECR polling-frontend
Jenkins updates k8s/kustomization.yml in polling-devops
Argo CD syncs the frontend deployment in EKS
```

## Repository Jobs

Create three Jenkins jobs.

Backend service job:

```text
Name: polling-backend-ci-cd
Repo: https://github.com/Harsha2318/voting_app.git
Branch: feature-1 or main
Script Path: Jenkinsfile
```

Frontend service job:

```text
Name: polling-frontend-ci-cd
Repo: https://github.com/Harsha2318/Polling_Application.git
Branch: feature-1 or main
Script Path: Jenkinsfile
```

DevOps validation job:

```text
Name: polling-devops-validate
Repo: https://github.com/Harsha2318/polling-devops.git
Branch: main
Script Path: Jenkinsfile
```

## Jenkins Requirements

Install these on the Jenkins agent:

```text
Java 21
Maven
Node.js and npm
Docker
AWS CLI
Trivy
kubectl
Kustomize
Terraform
Git
```

Install Jenkins plugins:

```text
Pipeline
Git
JUnit
Credentials Binding
SonarQube Scanner optional
```

Create this Jenkins credential:

```text
ID: github-token
Kind: Username with password
Username: Harsha2318
Password: GitHub token with contents read/write permission on polling-devops
```

Use an EC2 IAM role for Jenkins with ECR push access to:

```text
arn:aws:ecr:ap-south-1:140311410153:repository/polling-backend
arn:aws:ecr:ap-south-1:140311410153:repository/polling-frontend
```

## Local Separate Run

Start MySQL:

```powershell
docker run --name polling-mysql `
  -e MYSQL_DATABASE=voting_app_db `
  -e MYSQL_ROOT_PASSWORD=your_password `
  -p 3306:3306 `
  -d mysql:8.0
```

Run backend:

```powershell
cd "D:\Harsha P\projects\devops\voting_app"
$env:DB_URL="jdbc:mysql://localhost:3306/voting_app_db"
$env:DB_USERNAME="root"
$env:DB_PASSWORD="your_password"
mvn spring-boot:run
```

Run frontend:

```powershell
cd "D:\Harsha P\projects\devops\Polling_Application"
npm ci
npm start
```

Open:

```text
Frontend: http://localhost:4200
Backend:  http://localhost:8080/actuator/health
API:      http://localhost:8080/api/polls
```

## AWS Deployment

Create the EKS and ECR infrastructure from this repository:

```powershell
cd "D:\Harsha P\projects\devops\polling-devops"
aws login
aws configure export-credentials --profile default --format powershell | Invoke-Expression
.\scripts\create-all.ps1
```

Check Argo CD:

```powershell
kubectl get applications -n argocd
kubectl get pods -n polling-app
```

Run the backend Jenkins job once and the frontend Jenkins job once. Before those images exist in ECR, the Kubernetes app can show `ImagePullBackOff`; that is expected.

## Verification

Check ECR images:

```powershell
aws ecr list-images --repository-name polling-backend --region ap-south-1
aws ecr list-images --repository-name polling-frontend --region ap-south-1
```

Check Kubernetes:

```powershell
kubectl get applications -n argocd
kubectl get pods -n polling-app
kubectl get svc -n polling-app
```

Access frontend:

```powershell
kubectl port-forward svc/voting-frontend -n polling-app 8088:80
```

Open:

```text
http://localhost:8088
```

## Cleanup

EKS costs money. Destroy the demo after testing:

```powershell
cd "D:\Harsha P\projects\devops\polling-devops"
.\scripts\destroy-all.ps1
.\scripts\destroy-aws-demo.ps1
.\scripts\destroy-aws-demo.ps1 -Execute
```
