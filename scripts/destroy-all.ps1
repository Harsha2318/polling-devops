$ErrorActionPreference = "Continue"

function Export-AwsSsoCredentials {
  $exportText = aws configure export-credentials --profile default --format powershell 2>$null
  if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($exportText)) {
    Invoke-Expression $exportText
  }
}

Set-Location "$PSScriptRoot\.."

kubectl delete -f argocd/polling-application.yml --ignore-not-found=true
kubectl delete -f argocd/polling-project.yml --ignore-not-found=true
kubectl delete namespace argocd --ignore-not-found=true
kubectl delete namespace polling-app --ignore-not-found=true

Set-Location "$PSScriptRoot\..\terraform"
Export-AwsSsoCredentials
terraform destroy -auto-approve
