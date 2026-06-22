# CI/CD Runbook

This runbook explains how to run the Jenkins, ECR, EKS, Kustomize, and Argo CD workflow for the polling application.

## Architecture

The project uses three repositories:

```text
Harsha2318/voting_app           Backend Spring Boot service
Harsha2318/Polling_Application  Frontend Angular + Nginx service
Harsha2318/polling-devops       Jenkins, Kubernetes, Argo CD, Terraform, monitoring, scripts
```

The DevOps repository does not contain backend or frontend source code. Jenkins runs from `polling-devops`, temporarily clones the app repositories, builds both images, pushes them to ECR, updates `k8s/kustomization.yml`, and lets Argo CD deploy to EKS.

```text
Jenkins
  -> clone voting_app into backend-src
  -> clone Polling_Application into frontend-src
  -> build and test backend
  -> build frontend
  -> build Docker images
  -> scan with Trivy
  -> push images to ECR
  -> update polling-devops/k8s/kustomization.yml
  -> push GitOps commit
  -> Argo CD syncs EKS
```

## Step 1: Push Current Code

Push the frontend Nginx fix:

```powershell
cd "D:\Harsha P\projects\devops\Polling_Application"
git add nginx.conf
git commit -m "Fix nginx proxy for Kubernetes"
git push origin feature-1
```

Push the DevOps pipeline and docs:

```powershell
cd "D:\Harsha P\projects\devops\polling-devops"
git add Jenkinsfile README.md CI_CD_RUNBOOK.md
git commit -m "Implement multi-repo Jenkins GitOps pipeline"
git push origin fix-01
```

For final Jenkins usage, merge these changes into `main`, or configure the Jenkins job to read `Jenkinsfile` from `fix-01`.

## Step 2: Create AWS Infrastructure

From your local machine:

```powershell
cd "D:\Harsha P\projects\devops\polling-devops"
aws login
aws configure export-credentials --profile default --format powershell | Invoke-Expression
.\scripts\create-all.ps1
```

Configure `kubectl` for EKS:

```powershell
aws eks update-kubeconfig --region ap-south-1 --name polling-eks
kubectl get nodes
```

Install and apply Argo CD:

```powershell
.\scripts\deploy-argocd.ps1
kubectl get pods -n argocd
kubectl get applications -n argocd
```

## Step 3: Prepare Jenkins Server

Run these on the Jenkins EC2/server.

Install Java, Maven, Git, Docker, and basic tools:

```bash
sudo apt update
sudo apt install -y git curl unzip wget gnupg lsb-release apt-transport-https maven openjdk-21-jdk docker.io
sudo usermod -aG docker jenkins
sudo systemctl restart docker
sudo systemctl restart jenkins
```

Install Node.js 24:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
```

Install AWS CLI:

```bash
cd /tmp
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
unzip awscliv2.zip
sudo ./aws/install
```

Install Trivy:

```bash
wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | \
  gpg --dearmor | sudo tee /usr/share/keyrings/trivy.gpg > /dev/null

echo "deb [signed-by=/usr/share/keyrings/trivy.gpg] https://aquasecurity.github.io/trivy-repo/deb generic main" | \
  sudo tee /etc/apt/sources.list.d/trivy.list

sudo apt update
sudo apt install -y trivy
```

Install Kustomize:

```bash
curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" | bash
sudo mv kustomize /usr/local/bin/
```

Install kubectl:

```bash
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
```

Install Terraform:

```bash
sudo apt install -y gnupg software-properties-common
wget -O- https://apt.releases.hashicorp.com/gpg | \
  gpg --dearmor | sudo tee /usr/share/keyrings/hashicorp-archive-keyring.gpg > /dev/null

echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | \
  sudo tee /etc/apt/sources.list.d/hashicorp.list

sudo apt update
sudo apt install -y terraform
```

Verify tools:

```bash
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

## Step 4: Give Jenkins AWS Access

Recommended: attach an IAM role to the Jenkins EC2 instance.

For practice, attach:

```text
AmazonEC2ContainerRegistryPowerUser
```

Then test on Jenkins:

```bash
aws sts get-caller-identity
aws ecr describe-repositories --region ap-south-1
```

## Step 5: Add Jenkins GitHub Credential

In Jenkins:

```text
Manage Jenkins
Credentials
System
Global credentials
Add Credentials
```

Use:

```text
Kind: Username with password
ID: github-token
Username: Harsha2318
Password: GitHub personal access token
```

The token needs read access to all three repositories and write access to `polling-devops`.

## Step 6: Create Jenkins Pipeline Job

In Jenkins:

```text
New Item
Name: polling-devops-ci-cd
Type: Pipeline
```

Pipeline configuration:

```text
Definition: Pipeline script from SCM
SCM: Git
Repository URL: https://github.com/Harsha2318/polling-devops.git
Credentials: github-token
Branch: main
Script Path: Jenkinsfile
```

If the new Jenkinsfile is still on `fix-01`, use:

```text
Branch: fix-01
```

## Step 7: Run Jenkins Build

Click:

```text
Build with Parameters
```

Use these values for your current setup:

```text
ENABLE_SONAR=false
BACKEND_BRANCH=feature-1
FRONTEND_BRANCH=feature-1
BACKEND_REPO_URL=https://github.com/Harsha2318/voting_app.git
FRONTEND_REPO_URL=https://github.com/Harsha2318/Polling_Application.git
GITOPS_REPO=github.com/Harsha2318/polling-devops.git
GITOPS_BRANCH=main
AWS_REGION=ap-south-1
AWS_ACCOUNT_ID=140311410153
BACKEND_ECR_REPO=polling-backend
FRONTEND_ECR_REPO=polling-frontend
TRIVY_SEVERITY=HIGH,CRITICAL
```

If backend and frontend changes are merged into `main`, set:

```text
BACKEND_BRANCH=main
FRONTEND_BRANCH=main
```

## Step 8: Verify ECR

On Jenkins or your local AWS-authenticated terminal:

```bash
aws ecr describe-repositories --repository-names polling-backend polling-frontend --region ap-south-1
aws ecr list-images --repository-name polling-backend --region ap-south-1
aws ecr list-images --repository-name polling-frontend --region ap-south-1
```

On Jenkins, you can also check local images before push:

```bash
docker images | grep polling
```

## Step 9: Verify GitOps Update

After Jenkins succeeds, pull the DevOps repo:

```powershell
cd "D:\Harsha P\projects\devops\polling-devops"
git pull
Get-Content k8s\kustomization.yml
```

Expected: `newTag` should be a Jenkins-generated tag like:

```text
12-a1b2c3d4-e5f6a7b8
```

## Step 10: Verify Argo CD And Kubernetes

Check Argo CD:

```bash
argocd app get polling-app
argocd app sync polling-app
```

Check workloads:

```bash
kubectl get pods -n polling-app
kubectl get svc -n polling-app
kubectl get ingress -n polling-app
```

Access the frontend:

```bash
kubectl port-forward svc/voting-frontend -n polling-app 8088:80
```

Open:

```text
http://localhost:8088
```

Check backend directly:

```bash
kubectl port-forward svc/voting-backend -n polling-app 8080:8080
```

Open:

```text
http://localhost:8080/actuator/health
http://localhost:8080/api/polls
```

## Troubleshooting

Maven failure:

```bash
cd backend-src
mvn -B clean verify
```

Check Java version:

```bash
java -version
```

npm failure:

```bash
cd frontend-src
npm ci
npm run build
```

Check Node version:

```bash
node -v
npm -v
```

Docker permission denied:

```bash
sudo usermod -aG docker jenkins
sudo systemctl restart docker
sudo systemctl restart jenkins
```

ECR login failure:

```bash
aws sts get-caller-identity
aws ecr get-login-password --region ap-south-1
```

Trivy scan failure:

```bash
cat trivy-report.txt
```

Fix the vulnerable image or dependency, then rerun Jenkins.

Git push failure:

```text
Check Jenkins credential ID: github-token
Check token has write access to Harsha2318/polling-devops
Check GITOPS_BRANCH is main or the branch you really want Jenkins to update
```

Argo CD sync issue:

```bash
argocd app get polling-app
kubectl describe application polling-app -n argocd
```

ImagePullBackOff:

```bash
kubectl describe pod -n polling-app <pod-name>
aws ecr list-images --repository-name polling-backend --region ap-south-1
aws ecr list-images --repository-name polling-frontend --region ap-south-1
```

CrashLoopBackOff:

```bash
kubectl logs -n polling-app deploy/voting-backend
kubectl logs -n polling-app deploy/voting-frontend
kubectl describe pod -n polling-app <pod-name>
```

MySQL connection failure:

```bash
kubectl get svc mysql -n polling-app
kubectl get secret mysql-secret -n polling-app
kubectl logs -n polling-app deploy/mysql
kubectl logs -n polling-app deploy/voting-backend
```

Confirm backend has:

```text
DB_URL=jdbc:mysql://mysql:3306/voting_app_db
DB_USERNAME=root
DB_PASSWORD from mysql-secret
```

## Cleanup

EKS costs money. Destroy the demo after testing:

```powershell
cd "D:\Harsha P\projects\devops\polling-devops"
.\scripts\destroy-all.ps1
.\scripts\destroy-aws-demo.ps1
.\scripts\destroy-aws-demo.ps1 -Execute
```

