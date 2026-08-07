# Deployment Guide — ZoTok WhatsApp Mock Generator

## Hosting

**Platform**: AWS Amplify (Static Web Hosting)
**App**: `zotok-solutions`
**App ID**: `d316ym2oexcryf`
**Branch**: `main`
**Region**: `ap-south-1`
**Live URL**: `https://main.d316ym2oexcryf.amplifyapp.com`

Files served:
- `projects/**/*.html` — client journey mocks

---

## Prerequisites

### 1. AWS CLI installed
```bash
# macOS
brew install awscli

# Verify
aws --version
```

### 2. AWS credentials configured
The IAM user needs the following Amplify permission on the `zotok-solutions` app:
```json
{
  "Effect": "Allow",
  "Action": [
    "amplify:CreateDeployment",
    "amplify:StartDeployment",
    "amplify:GetJob"
  ],
  "Resource": "arn:aws:amplify:ap-south-1:829773436660:apps/d316ym2oexcryf/*"
}
```

Configure credentials:
```bash
aws configure
# AWS Access Key ID: <your-key>
# AWS Secret Access Key: <your-secret>
# Default region name: ap-south-1
# Default output format: json
```

---

## Deploy

From the project root:

```bash
./deploy.sh
```

The script will:
1. Check AWS CLI and credentials
2. Zip the `projects/` directory
3. Create a deployment and get a presigned S3 upload URL from Amplify
4. Upload the zip
5. Start the deployment
6. Poll until complete and print the live URLs

Typical deploy time: **15–30 seconds**.

---

## Accessing Deployed Files

Files are available at their folder path:

```
https://main.d316ym2oexcryf.amplifyapp.com/projects/<client>/<journey>.html
https://main.d316ym2oexcryf.amplifyapp.com/references/<template>.html
```

Examples:
```
.../projects/Hindalco/journey_dsr_expense_claim.html
.../projects/lucky_seeds/journey_retailer_ordering.html
.../references/tmpl_admin_dashboard.html
```

---

## Manual Deploy (without the script)

If you prefer running commands manually:

```bash
# 1. Zip the content
cd /path/to/whatsapp-mock-generator
zip -r /tmp/zotok-deploy.zip projects/ --exclude "*.DS_Store"

# 2. Create deployment — note the jobId and zipUploadUrl in the response
aws amplify create-deployment \
  --app-id d316ym2oexcryf \
  --branch-name main \
  --region ap-south-1

# 3. Upload the zip to the presigned URL from step 2
curl -X PUT \
  --data-binary "@/tmp/zotok-deploy.zip" \
  --header "Content-Type: application/zip" \
  "<zipUploadUrl from step 2>"

# 4. Start the deployment using the jobId from step 2
aws amplify start-deployment \
  --app-id d316ym2oexcryf \
  --branch-name main \
  --job-id <jobId from step 2> \
  --region ap-south-1

# 5. Check status
aws amplify get-job \
  --app-id d316ym2oexcryf \
  --branch-name main \
  --job-id <jobId> \
  --region ap-south-1 \
  --query 'job.summary.status'
```

---

## Notes

- No build step — all files are plain HTML with zero dependencies.
- The Amplify app is configured for **manual zip deployments only** (`enableBranchAutoBuild: false`). It is not connected to a Git repository.
- The `deploy.sh` script only packages `projects/`. Development files (`CLAUDE.md`, `guidelines/`, `references/`, `deploy.sh`, etc.) are intentionally excluded.
- Only one person needs AWS credentials — share the live URLs with the rest of the team after deploying.
