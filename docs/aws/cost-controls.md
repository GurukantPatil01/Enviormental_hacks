# EcoPulse AWS Cost Guardrails & Budget Controls

## 1. Hackathon Cost Philosophy

EcoPulse is designed for maximum operational efficiency and strict financial discipline:
1. **No Always-On Compute:** No EC2 instances or Lightsail containers running 24/7. Compute is strictly serverless (AWS Lambda) which scales to zero.
2. **No Managed OpenSearch / Vector Clusters:** OpenSearch Serverless requires a minimum of 2 OCUs (~$700/month). EcoPulse avoids this completely by utilizing PostgreSQL `pgvector`.
3. **No Mandatory Bedrock or Titan:** Local mock and edge providers handle 100% of unit tests and local iteration. Bedrock is only invoked when explicitly turned on via config.
4. **No Mandatory Managed RDS:** The backend connects to existing databases or free-tier serverless PostgreSQL instances (e.g. Neon).

---

## 2. Resource-Level Cost Safeguards

### S3 Storage Lifecycle Rules
Defined in `infra/aws/s3.tf`:
- Temporary upload artifacts (`artifacts/temp/*`) automatically expire and are purged after **7 days**.
- Old evidentiary photos transition to low-cost **Glacier** storage after **90 days** in production.

### CloudWatch Log Retention
Default CloudWatch log groups store data indefinitely, accumulating storage costs. EcoPulse configures explicit retention limits:
- `dev`: **7 days**
- `staging`: **14 days**
- `prod`: **30 days**

### Mandatory Resource Tagging
All resources declared in Terraform inherit default tags for exact cost-center attribution:
```hcl
default_tags {
  tags = {
    Project     = "EcoPulse"
    Environment = "dev"
    Owner       = "EcoPulse"
    CostCenter  = "Hackathon"
    ManagedBy   = "Terraform"
  }
}
```

---

## 3. AWS Budgets Setup Guide (Step-by-Step)

To prevent unexpected billing, create proactive spending alerts in the AWS Console:

### Recommended Alert Tiers
- **Tier 1:** $5.00 USD (Early Warning)
- **Tier 2:** $10.00 USD (Investigation Trigger)
- **Tier 3:** $20.00 USD (Emergency Circuit Breaker)

### Console Steps:
1. Sign in to the **AWS Management Console** and navigate to **Billing and Cost Management**.
2. In the left navigation menu, click **Budgets**.
3. Click the orange **Create budget** button.
4. Select **Cost budget (Recommended)** and click **Next**.
5. Set the budget details:
   - **Period:** Monthly
   - **Budget effective date:** Recurring budget
   - **Budget method:** Fixed
   - **Enter your budgeted amount:** `$5.00`
   - **Budget name:** `EcoPulse-Hackathon-Safety-Budget`
6. Click **Next** to configure alert thresholds:
   - **Threshold 1:** Set to `80%` of budgeted amount ($4.00 forecasted/actual).
   - **Threshold 2:** Set to `100%` of budgeted amount ($5.00 actual).
   - Enter your email address for notification recipients.
7. Review budget details and click **Create budget**.
