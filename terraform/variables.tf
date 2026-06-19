variable "aws_region" {
  description = "AWS region for the EKS environment."
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Project prefix used for AWS resources."
  type        = string
  default     = "polling-devops"
}

variable "cluster_name" {
  description = "EKS cluster name."
  type        = string
  default     = "polling-eks"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.10.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "Two public subnet CIDR blocks for the EKS cluster."
  type        = list(string)
  default     = ["10.10.1.0/24", "10.10.2.0/24"]
}

variable "availability_zones" {
  description = "Availability zones mapped to the public subnets."
  type        = list(string)
  default     = ["ap-south-1a", "ap-south-1b"]
}

variable "node_instance_type" {
  description = "Managed node group instance type."
  type        = string
  default     = "t3.small"
}

variable "desired_size" {
  description = "Desired node count."
  type        = number
  default     = 2
}

variable "min_size" {
  description = "Minimum node count."
  type        = number
  default     = 1
}

variable "max_size" {
  description = "Maximum node count."
  type        = number
  default     = 3
}

variable "node_disk_size" {
  description = "EKS worker node disk size in GiB."
  type        = number
  default     = 20
}

