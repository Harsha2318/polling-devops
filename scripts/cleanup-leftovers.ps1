$ErrorActionPreference = "Continue"

kubectl delete namespace argocd --ignore-not-found=true
kubectl delete namespace polling-app --ignore-not-found=true

$region = "ap-south-1"
aws eks list-clusters --region $region
aws ecr describe-repositories --region $region
aws ec2 describe-instances --region $region --query "Reservations[].Instances[].{Id:InstanceId,State:State.Name}" --output table

