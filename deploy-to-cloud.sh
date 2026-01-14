#!/bin/bash
set -e

# Configuration
PROJECT_ID="gen-lang-client-0692818755"
REGION="us-central1"

# API Keys - Load from environment or .env file
# To use: export GROQ_API_KEY="your_key" before running this script
# Or create a .env file (not committed to git) with these variables
if [ -z "$GROQ_API_KEY" ] || [ -z "$GOOGLE_MAPS_API_KEY" ] || [ -z "$ELEVEN_LABS_API_KEY" ]; then
    echo "❌ Error: Required environment variables not set"
    echo "Please set the following environment variables before deploying:"
    echo "  - GROQ_API_KEY"
    echo "  - GOOGLE_MAPS_API_KEY"
    echo "  - ELEVEN_LABS_API_KEY"
    echo ""
    echo "Example:"
    echo "  export GROQ_API_KEY='your_key_here'"
    echo "  export GOOGLE_MAPS_API_KEY='your_key_here'"
    echo "  export ELEVEN_LABS_API_KEY='your_key_here'"
    exit 1
fi

echo "🚀 Deploying LoanTwin OS to Google Cloud Run..."
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Deploy Backend
echo "📦 Deploying backend service..."
gcloud run deploy loantwin-backend \
  --source=./backend \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --memory=1Gi \
  --project=$PROJECT_ID \
  --set-env-vars="GROQ_API_KEY=${GROQ_API_KEY},GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY},ELEVEN_LABS_API_KEY=${ELEVEN_LABS_API_KEY}"

# Get backend URL
BACKEND_URL=$(gcloud run services describe loantwin-backend --region=$REGION --project=$PROJECT_ID --format='value(status.url)')
echo "✅ Backend deployed at: $BACKEND_URL"
echo ""

# Deploy Frontend
echo "📦 Deploying frontend service..."
gcloud run deploy loantwin-frontend \
  --source=./frontend \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --project=$PROJECT_ID \
  --set-env-vars="NEXT_PUBLIC_API_URL=$BACKEND_URL"

# Get frontend URL
FRONTEND_URL=$(gcloud run services describe loantwin-frontend --region=$REGION --project=$PROJECT_ID --format='value(status.url)')
echo "✅ Frontend deployed at: $FRONTEND_URL"
echo ""

echo "🎉 Deployment complete!"
echo ""
echo "Backend API: $BACKEND_URL"
echo "Frontend App: $FRONTEND_URL"
echo ""
echo "You can now access your application at: $FRONTEND_URL"
