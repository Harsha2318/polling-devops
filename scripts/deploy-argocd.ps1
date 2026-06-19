$ErrorActionPreference = "Stop"

kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -n argocd --server-side --force-conflicts -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl wait --for=condition=available deployment/argocd-server -n argocd --timeout=300s
kubectl apply -f "$PSScriptRoot\..\argocd\polling-project.yml"
kubectl apply -f "$PSScriptRoot\..\argocd\polling-application.yml"
kubectl get applications -n argocd

