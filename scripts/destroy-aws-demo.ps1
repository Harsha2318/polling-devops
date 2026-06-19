param(
  [string]$Region = "ap-south-1",
  [string]$Profile = "default",
  [switch]$Execute,
  [string[]]$InstanceNames = @("polling-jenkins-ec2", "jenkins-vm", "slave-vm1", "slave-vm2"),
  [string[]]$EcrRepositories = @("polling-backend", "polling-frontend"),
  [string[]]$SecurityGroupNames = @("polling-jenkins-sg", "polling-devops-eks-nodes"),
  [string[]]$IamRoles = @("polling-jenkins-ec2-role", "polling-devops-eks-cluster-role", "polling-devops-eks-node-role"),
  [string[]]$InstanceProfiles = @("polling-jenkins-ec2-profile"),
  [string]$ProjectVpcName = "polling-devops-vpc"
)

$ErrorActionPreference = "Continue"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message"
}

function Invoke-IfExecute {
  param(
    [string]$Description,
    [scriptblock]$Action
  )

  if ($Execute) {
    Write-Host "RUN: $Description"
    & $Action
  } else {
    Write-Host "DRY-RUN: $Description"
  }
}

function Export-AwsSessionCredentials {
  Write-Step "Exporting AWS credentials for Terraform compatibility"
  $exportText = aws configure export-credentials --profile $Profile --format powershell 2>$null
  if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($exportText)) {
    Invoke-Expression ($exportText -join [Environment]::NewLine)
  }
  $env:AWS_REGION = $Region
  $env:AWS_DEFAULT_REGION = $Region
}

function Get-Json {
  param([scriptblock]$Command)

  $output = & $Command 2>$null
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($output)) {
    return $null
  }
  return $output | ConvertFrom-Json
}

function Remove-KubernetesWorkloads {
  Write-Step "Deleting Kubernetes namespaces if kubectl is available"
  $kubectl = Get-Command kubectl -ErrorAction SilentlyContinue
  if (-not $kubectl) {
    Write-Host "kubectl not found; skipping Kubernetes namespace cleanup."
    return
  }

  Invoke-IfExecute "kubectl delete namespace argocd polling-app" {
    kubectl delete namespace argocd --ignore-not-found=true
    kubectl delete namespace polling-app --ignore-not-found=true
  }
}

function Invoke-TerraformDestroy {
  Write-Step "Destroying Terraform-managed AWS resources"
  $terraformDir = Join-Path $PSScriptRoot "..\terraform"
  if (-not (Test-Path $terraformDir)) {
    Write-Host "Terraform directory not found; skipping."
    return
  }

  Push-Location $terraformDir
  try {
    $stateOutput = terraform state list 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($stateOutput)) {
      Write-Host "Terraform state is empty or unavailable; skipping terraform destroy."
      return
    }

    Write-Host "Terraform state resources:"
    $stateOutput
    Invoke-IfExecute "terraform destroy -auto-approve" {
      terraform destroy -auto-approve
    }
  } finally {
    Pop-Location
  }
}

function Remove-Ec2Instances {
  Write-Step "Terminating known demo EC2 instances"
  $nameValues = $InstanceNames -join ","
  $instances = Get-Json { aws ec2 describe-instances --region $Region --filters "Name=tag:Name,Values=$nameValues" "Name=instance-state-name,Values=pending,running,stopping,stopped" --query "Reservations[].Instances[].InstanceId" --output json }
  if (-not $instances -or $instances.Count -eq 0) {
    Write-Host "No matching EC2 instances found."
    return
  }

  Write-Host "Matching EC2 instances: $($instances -join ', ')"
  Invoke-IfExecute "terminate EC2 instances $($instances -join ', ')" {
    aws ec2 terminate-instances --region $Region --instance-ids $instances
    aws ec2 wait instance-terminated --region $Region --instance-ids $instances
  }
}

function Remove-EcrRepositories {
  Write-Step "Deleting demo ECR repositories"
  foreach ($repo in $EcrRepositories) {
    $exists = Get-Json { aws ecr describe-repositories --region $Region --repository-names $repo --output json }
    if (-not $exists) {
      Write-Host "ECR repository not found: $repo"
      continue
    }

    Invoke-IfExecute "delete ECR repository $repo with --force" {
      aws ecr delete-repository --region $Region --repository-name $repo --force
    }
  }
}

function Remove-IamResources {
  Write-Step "Deleting manually created Jenkins IAM resources"

  foreach ($profile in $InstanceProfiles) {
    $profileData = Get-Json { aws iam get-instance-profile --instance-profile-name $profile --output json }
    if ($profileData) {
      foreach ($role in $profileData.InstanceProfile.Roles) {
        Invoke-IfExecute "remove role $($role.RoleName) from instance profile $profile" {
          aws iam remove-role-from-instance-profile --instance-profile-name $profile --role-name $role.RoleName
        }
      }
      Invoke-IfExecute "delete instance profile $profile" {
        aws iam delete-instance-profile --instance-profile-name $profile
      }
    } else {
      Write-Host "Instance profile not found: $profile"
    }
  }

  foreach ($roleName in $IamRoles) {
    $role = Get-Json { aws iam get-role --role-name $roleName --output json }
    if (-not $role) {
      Write-Host "IAM role not found: $roleName"
      continue
    }

    $attachedPolicies = Get-Json { aws iam list-attached-role-policies --role-name $roleName --output json }
    foreach ($policy in $attachedPolicies.AttachedPolicies) {
      Invoke-IfExecute "detach managed policy $($policy.PolicyArn) from $roleName" {
        aws iam detach-role-policy --role-name $roleName --policy-arn $policy.PolicyArn
      }
    }

    $inlinePolicies = Get-Json { aws iam list-role-policies --role-name $roleName --output json }
    foreach ($policyName in $inlinePolicies.PolicyNames) {
      Invoke-IfExecute "delete inline policy $policyName from $roleName" {
        aws iam delete-role-policy --role-name $roleName --policy-name $policyName
      }
    }

    Invoke-IfExecute "delete IAM role $roleName" {
      aws iam delete-role --role-name $roleName
    }
  }
}

function Remove-SecurityGroups {
  Write-Step "Deleting known demo security groups"
  $nameValues = $SecurityGroupNames -join ","
  $groups = Get-Json { aws ec2 describe-security-groups --region $Region --filters "Name=group-name,Values=$nameValues" --query "SecurityGroups[].GroupId" --output json }
  if (-not $groups -or $groups.Count -eq 0) {
    Write-Host "No matching security groups found."
    return
  }

  foreach ($groupId in $groups) {
    Invoke-IfExecute "delete security group $groupId" {
      aws ec2 delete-security-group --region $Region --group-id $groupId
    }
  }
}

function Remove-ProjectVpcIfEmpty {
  Write-Step "Deleting empty project VPC if it remains"
  $vpcs = Get-Json { aws ec2 describe-vpcs --region $Region --filters "Name=tag:Name,Values=$ProjectVpcName" --query "Vpcs[].VpcId" --output json }
  if (-not $vpcs -or $vpcs.Count -eq 0) {
    Write-Host "Project VPC not found."
    return
  }

  foreach ($vpcId in $vpcs) {
    Invoke-IfExecute "delete VPC $vpcId" {
      aws ec2 delete-vpc --region $Region --vpc-id $vpcId
    }
  }
}

function Show-FinalCostCheck {
  Write-Step "Final AWS cost-resource check"

  Write-Host "EKS clusters:"
  aws eks list-clusters --region $Region --output table

  Write-Host "EC2 instances not terminated:"
  aws ec2 describe-instances --region $Region --filters "Name=instance-state-name,Values=pending,running,stopping,stopped" --query "Reservations[].Instances[].{Id:InstanceId,State:State.Name,Type:InstanceType,Name:Tags[?Key=='Name']|[0].Value}" --output table

  Write-Host "EBS volumes:"
  aws ec2 describe-volumes --region $Region --filters "Name=status,Values=available,in-use" --query "Volumes[].{Id:VolumeId,State:State,Size:Size,Instance:Attachments[0].InstanceId}" --output table

  Write-Host "Elastic IP addresses:"
  aws ec2 describe-addresses --region $Region --query "Addresses[].{Ip:PublicIp,AllocationId:AllocationId,Instance:InstanceId}" --output table

  Write-Host "ECR repositories:"
  aws ecr describe-repositories --region $Region --query "repositories[].repositoryName" --output table 2>$null

  Write-Host "Load balancers:"
  aws elbv2 describe-load-balancers --region $Region --query "LoadBalancers[].{Name:LoadBalancerName,State:State.Code,DNS:DNSName}" --output table 2>$null

  Write-Host "NAT gateways:"
  aws ec2 describe-nat-gateways --region $Region --query "NatGateways[].{Id:NatGatewayId,State:State,Vpc:VpcId}" --output table
}

Write-Host "AWS demo cleanup"
Write-Host "Region: $Region"
Write-Host "Mode: $(if ($Execute) { 'EXECUTE' } else { 'DRY-RUN' })"

Export-AwsSessionCredentials
Remove-KubernetesWorkloads
Invoke-TerraformDestroy
Remove-Ec2Instances
Remove-EcrRepositories
Remove-IamResources
Remove-SecurityGroups
Remove-ProjectVpcIfEmpty
Show-FinalCostCheck

if (-not $Execute) {
  Write-Host ""
  Write-Host "Dry-run complete. Re-run with -Execute to delete matching resources."
}
