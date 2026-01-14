#!/bin/bash
set -e

PROJECT_ID="gen-lang-client-0692818755"
REGION="us-central1"
BACKEND_URL="https://loantwin-backend-fozkypxpga-uc.a.run.app"

echo "🚀 Deploying LoanTwin OS Frontend to Google Cloud Run..."
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Backend URL: $BACKEND_URL"
echo ""

# Deploy Frontend only
echo "📦 Deploying frontend service..."
gcloud run deploy loantwin-frontend \
  --source=./frontend \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --project=$PROJECT_ID \
  --set-env-vars="NEXT_PUBLIC_API_BASE=$BACKEND_URL,NEXT_PUBLIC_API_URL=$BACKEND_URL"

# Get frontend URL
FRONTEND_URL=$(gcloud run services describe loantwin-frontend --region=$REGION --project=$PROJECT_ID --format='value(status.url)')
echo ""
echo "🎉 Frontend deployment complete!"
echo ""
echo "Frontend App: $FRONTEND_URL"
echo "Backend API: $BACKEND_URL"
echo ""
echo "You can now access your application at: $FRONTEND_URL"
