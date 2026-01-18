#!/bin/bash

# AlphaClone Systems - Deployment Script
# This script helps automate the deployment process

echo "🚀 AlphaClone Systems Deployment Script"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Git
echo -e "${YELLOW}Step 1: Pushing to GitHub${NC}"
echo "Current branch: $(git branch --show-current)"
echo ""
read -p "Commit message (default: 'Deploy to production'): " commit_msg
commit_msg=${commit_msg:-"Deploy to production"}

git add .
git commit -m "$commit_msg"
git push origin main

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Successfully pushed to GitHub${NC}"
else
    echo -e "${RED}✗ Failed to push to GitHub${NC}"
    exit 1
fi

echo ""

# Step 2: Supabase
echo -e "${YELLOW}Step 2: Deploying to Supabase${NC}"
read -p "Apply database migrations? (y/n): " apply_migrations

if [ "$apply_migrations" = "y" ]; then
    echo "Applying migrations..."
    supabase db push
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Migrations applied successfully${NC}"
    else
        echo -e "${RED}✗ Failed to apply migrations${NC}"
        exit 1
    fi
fi

echo ""

# Step 3: Vercel
echo -e "${YELLOW}Step 3: Deploying to Vercel${NC}"
read -p "Deploy to Vercel production? (y/n): " deploy_vercel

if [ "$deploy_vercel" = "y" ]; then
    echo "Deploying to Vercel..."
    vercel --prod
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Successfully deployed to Vercel${NC}"
    else
        echo -e "${RED}✗ Failed to deploy to Vercel${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}========================================"
echo "🎉 Deployment Complete!"
echo "========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Verify your deployment at your Vercel URL"
echo "2. Test registration and login"
echo "3. Check database connections"
echo "4. Run Lighthouse audit"
echo ""
