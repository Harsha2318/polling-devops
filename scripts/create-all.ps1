$ErrorActionPreference = "Stop"

Set-Location "$PSScriptRoot\..\terraform"

terraform init
terraform fmt -recursive
terraform validate
terraform apply -auto-approve

$clusterName = terraform output -raw cluster_name
$region = (Get-Content .\terraform.tfvars -ErrorAction SilentlyContinue | Select-String '^aws_region' | ForEach-Object { ($_ -split '=')[1].Trim().Trim('"') })
if (-not $region) {
  $region = "ap-south-1"
}

aws eks update-kubeconfig --region $region --name $clusterName
kubectl get nodes

Set-Location "$PSScriptRoot\.."

kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -n argocd --server-side --force-conflicts -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl wait --for=condition=available deployment/argocd-server -n argocd --timeout=300s

kubectl apply -f argocd/polling-project.yml
kubectl apply -f argocd/polling-application.yml

kubectl get pods -A
kubectl get applications -n argocd

