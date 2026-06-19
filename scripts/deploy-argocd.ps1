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

Invoke-CheckedCommand { kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f - }
Invoke-CheckedCommand { kubectl apply -n argocd --server-side --force-conflicts -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml }
Invoke-CheckedCommand { kubectl wait --for=condition=available deployment/argocd-server -n argocd --timeout=300s }
Invoke-CheckedCommand { kubectl apply -f "$PSScriptRoot\..\argocd\polling-project.yml" }
Invoke-CheckedCommand { kubectl apply -f "$PSScriptRoot\..\argocd\polling-application.yml" }
Invoke-CheckedCommand { kubectl get applications -n argocd }
