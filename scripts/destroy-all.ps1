$ErrorActionPreference = "Continue"

Set-Location "$PSScriptRoot\.."

kubectl delete -f argocd/polling-application.yml --ignore-not-found=true
kubectl delete -f argocd/polling-project.yml --ignore-not-found=true
kubectl delete namespace argocd --ignore-not-found=true
kubectl delete namespace polling-app --ignore-not-found=true

Set-Location "$PSScriptRoot\..\terraform"
terraform destroy -auto-approve

