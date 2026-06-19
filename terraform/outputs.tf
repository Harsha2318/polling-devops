output "cluster_name" {
  description = "Amazon EKS cluster name."
  value       = aws_eks_cluster.polling.name
}

output "cluster_endpoint" {
  description = "Amazon EKS cluster endpoint."
  value       = aws_eks_cluster.polling.endpoint
}

output "backend_ecr_repository_url" {
  description = "Backend ECR repository URL."
  value       = aws_ecr_repository.backend.repository_url
}

output "frontend_ecr_repository_url" {
  description = "Frontend ECR repository URL."
  value       = aws_ecr_repository.frontend.repository_url
}

output "vpc_id" {
  description = "VPC ID for the EKS cluster."
  value       = aws_vpc.polling.id
}

