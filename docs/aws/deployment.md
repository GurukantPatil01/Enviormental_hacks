# Infrastructure Deployment Guide

## 1. Overview

EcoPulse infrastructure is defined using modular Terraform under `infra/aws/`. 

**Important:** Infrastructure is NOT automatically deployed. Deployments must be explicitly initiated by an engineer after setting up AWS CLI credentials and setting a budget alert.

---

## 2. Infrastructure as Code Structure

```
infra/aws/
├── main.tf            # AWS Provider & tag configuration
├── variables.tf       # Parameter declarations
├── outputs.tf         # Resource ARNs and IDs
├── s3.tf              # Private evidence bucket & lifecycle rules
├── eventbridge.tf     # Custom event bus & event routing rules
├── lambda.tf          # Serverless processor functions & permissions
├── cloudwatch.tf      # Log groups with short retention & alarms
├── iam.tf             # Least-privilege roles and policies
└── environments/
    ├── dev.tfvars     # Dev environment configuration
    ├── staging.tfvars # Staging environment configuration
    └── prod.tfvars    # Production environment configuration
```

---

## 3. Deployment Steps

### Step 1: Configure AWS CLI Credentials
```bash
aws configure
# Enter AWS Access Key ID, Secret Access Key, and Default Region (ap-south-1)
```

### Step 2: Initialize Terraform
```bash
cd infra/aws
terraform init
```

### Step 3: Plan Infrastructure (Dry Run)
```bash
terraform plan -var-file="environments/dev.tfvars"
```

Review the proposed resources:
- 1x S3 Bucket (`ecopulse-storage-dev`)
- 1x EventBridge Bus (`ecopulse-events-dev`) + 4 Rules
- 4x Lambda Functions (Report, AI, Embedding, Hotspot processors)
- 4x CloudWatch Log Groups (7-day retention)
- 1x IAM Role + Policies

### Step 4: Apply Infrastructure (When Ready)
```bash
terraform apply -var-file="environments/dev.tfvars"
```

### Step 5: Teardown / Destruction (Zero-Residual Clean-Up)
When testing is complete or the hackathon concludes:
```bash
terraform destroy -var-file="environments/dev.tfvars"
```
