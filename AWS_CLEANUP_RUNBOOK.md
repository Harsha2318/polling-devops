# AWS Cleanup Runbook

Use this when you finish an EKS/Jenkins demo and want to avoid ongoing AWS cost.

The main cleanup command is:

```powershell
cd "D:\Harsha P\projects\devops\polling-devops"
.\scripts\destroy-aws-demo.ps1 -Execute
```

The script is dry-run by default. To preview what it will target:

```powershell
.\scripts\destroy-aws-demo.ps1
```

## What It Removes

The cleanup script removes the resources this demo can create:

- Terraform-managed EKS, ECR, VPC, subnets, route tables, internet gateway, and IAM roles
- Jenkins EC2 instance named `polling-jenkins-ec2`
- Older Jenkins/slave EC2 names used during testing: `jenkins-vm`, `slave-vm1`, `slave-vm2`
- Remaining ECR repositories named `polling-backend` and `polling-frontend`
- Project security groups named `polling-jenkins-sg` and `polling-devops-eks-nodes`
- Jenkins IAM role and instance profile named `polling-jenkins-ec2-role` and `polling-jenkins-ec2-profile`
- Empty project VPC tagged `polling-devops-vpc`

It also reports common hidden cost sources:

- EC2 instances
- EBS volumes
- Elastic IPs
- EKS clusters
- ECR repositories
- Load balancers
- NAT gateways

## Safe Order

1. Export AWS credentials for Terraform:

```powershell
aws configure export-credentials --profile default --format powershell | Invoke-Expression
```

2. Preview cleanup:

```powershell
.\scripts\destroy-aws-demo.ps1
```

3. Run cleanup:

```powershell
.\scripts\destroy-aws-demo.ps1 -Execute
```

4. Run it again as a verification pass:

```powershell
.\scripts\destroy-aws-demo.ps1
```

The second dry-run should show no project resources left.

## Manual Verification Commands

Run these if you want to double-check from the AWS CLI:

```powershell
aws eks list-clusters --region ap-south-1
aws ec2 describe-instances --region ap-south-1 --filters Name=instance-state-name,Values=pending,running,stopping,stopped --query "Reservations[].Instances[].{Id:InstanceId,State:State.Name,Name:Tags[?Key=='Name']|[0].Value}" --output table
aws ec2 describe-volumes --region ap-south-1 --filters Name=status,Values=available,in-use --query "Volumes[].{Id:VolumeId,State:State,Size:Size,Instance:Attachments[0].InstanceId}" --output table
aws ec2 describe-addresses --region ap-south-1
aws ecr describe-repositories --region ap-south-1
aws elbv2 describe-load-balancers --region ap-south-1
aws ec2 describe-nat-gateways --region ap-south-1
```

Empty output for these project resources means the demo environment is gone.

## Important Notes

- AWS Billing can lag by a few hours. If resources are deleted now, the billing page may still show earlier usage until it refreshes.
- Stopped EC2 instances can still have attached EBS volumes. The cleanup script terminates known demo instances instead of only stopping them.
- EKS has an hourly control-plane charge. Always destroy temporary EKS environments after testing.
- NAT Gateway and load balancers are common hidden costs. This project intentionally avoids NAT Gateway, but the cleanup script still checks for it.
