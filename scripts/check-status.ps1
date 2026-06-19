$ErrorActionPreference = "Stop"

kubectl get nodes -o wide
kubectl get pods -A
kubectl get applications -n argocd
kubectl get svc -n polling-app

