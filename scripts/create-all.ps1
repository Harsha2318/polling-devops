$ErrorActionPreference = "Stop"

function Invoke-CheckedCommand {
  param(
    [Parameter(Mandatory = $true)]
    [scriptblock]$Command
  )

  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code $LASTEXITCODE"
  }
}

function Export-AwsSsoCredentials {
  $exportText = aws configure export-credentials --profile default --format powershell 2>$null
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($exportText)) {
    throw "AWS credential export failed. Run 'aws login' first."
  }

  Invoke-Expression $exportText
  if (-not $env:AWS_ACCESS_KEY_ID) {
    throw "AWS credentials were not exported into the current PowerShell session."
  }
}

Export-AwsSsoCredentials

Set-Location "$PSScriptRoot\..\terraform"

Invoke-CheckedCommand { terraform init }
Invoke-CheckedCommand { terraform fmt -recursive }
Invoke-CheckedCommand { terraform validate }
Invoke-CheckedCommand { terraform apply -auto-approve }

$clusterName = terraform output -raw cluster_name
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($clusterName)) {
  throw "Terraform did not return a cluster_name output."
}

$region = (Get-Content .\terraform.tfvars -ErrorAction SilentlyContinue | Select-String '^aws_region' | ForEach-Object { ($_ -split '=')[1].Trim().Trim('"') })
if (-not $region) {
  $region = "ap-south-1"
}

$env:AWS_REGION = $region
$env:AWS_DEFAULT_REGION = $region

Invoke-CheckedCommand { aws eks update-kubeconfig --region $region --name $clusterName }
Invoke-CheckedCommand { kubectl get nodes }

Set-Location "$PSScriptRoot\.."

Invoke-CheckedCommand { kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f - }
Invoke-CheckedCommand { kubectl apply -n argocd --server-side --force-conflicts -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml }
Invoke-CheckedCommand { kubectl wait --for=condition=available deployment/argocd-server -n argocd --timeout=300s }

Invoke-CheckedCommand { kubectl apply -f argocd/polling-project.yml }
Invoke-CheckedCommand { kubectl apply -f argocd/polling-application.yml }

Invoke-CheckedCommand { kubectl get pods -A }
Invoke-CheckedCommand { kubectl get applications -n argocd }
