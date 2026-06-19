# AWS free-tier-friendly plan

This project can use Amazon EKS only if it is treated as a temporary demo environment that is created, tested, and destroyed quickly.

## Cost-controlled EKS rule

Amazon EKS is a paid managed control plane. Even before worker nodes, storage, or load balancers, EKS has a cluster hourly charge. That means it is not a free-tier service, but it can still be used safely for a short-lived demo if you destroy it immediately after testing.

## Recommended temporary EKS path

Use AWS like this:

1. One EKS cluster
2. Two worker nodes for cheaper testing
3. Optional move to three worker nodes for the final demo
4. Use Amazon ECR
5. No NAT Gateway
6. No always-on public load balancer unless needed briefly
7. Destroy everything after testing

## Suggested architecture

```text
GitHub
  ->
Jenkins
  ->
SonarQube and Trivy
  ->
Amazon ECR
  ->
Terraform-created Amazon EKS
  ->
Argo CD
  ->
Temporary runtime
  ->
terraform destroy
```

## Best practical choices

### Option A: cheaper test run

- Run 2 `t3.small` EKS worker nodes
- Use ECR for images
- Use port-forward for app access when possible
- Destroy after testing

### Option B: better final demo

- Run 3 `t3.small` EKS worker nodes
- Keep Argo CD in EKS
- Keep Jenkins local or on a separate temporary machine
- Destroy after the demo

### Option C: smoother but costlier

- Use `t3.medium` nodes if pods are memory constrained
- Use this only if `t3.small` cannot handle the workloads you choose to run

## What to avoid for now

- NAT Gateway
- Permanent public load balancers
- Running SonarQube and Nexus inside EKS
- NAT Gateway
- RDS
- Leaving the cluster running after the demo

## Practical recommendation for this repo

If you want the project to remain affordable:

- Keep Jenkins, SonarQube, Trivy, and heavy tooling outside EKS
- Use EKS only for app runtime and Argo CD
- Prefer 2 nodes for normal testing
- Move to 3 nodes only for the final project demo
- Run `terraform destroy` immediately after you finish
