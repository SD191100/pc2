#!/bin/bash
# Garage initialization script for PC2
# This script initializes Garage, creates access keys, and sets up the pulumi-state bucket

set -e

GARAGE_ADMIN_URL="${GARAGE_ADMIN_URL:-http://localhost:3903}"
BUCKET_NAME="pulumi-state"

echo "=== Garage Initialization Script ==="
echo ""

# Wait for Garage to be ready
echo "Waiting for Garage to be ready..."
until curl -sf "${GARAGE_ADMIN_URL}/health" > /dev/null 2>&1; do
    echo "  Garage not ready yet, waiting..."
    sleep 2
done
echo "Garage is ready!"
echo ""

# Get cluster status
echo "Getting cluster status..."
CLUSTER_STATUS=$(curl -sf "${GARAGE_ADMIN_URL}/v1/status" 2>/dev/null || echo "")

if [ -z "$CLUSTER_STATUS" ]; then
    echo "ERROR: Could not get cluster status. Make sure Garage admin API is accessible."
    exit 1
fi

NODE_ID=$(echo "$CLUSTER_STATUS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Node ID: $NODE_ID"

# Check if node is already configured
LAYOUT=$(curl -sf "${GARAGE_ADMIN_URL}/v1/layout" 2>/dev/null || echo "")
STAGED_COUNT=$(echo "$LAYOUT" | grep -o '"stagedRoleChanges":\[[^]]*\]' | grep -c "$NODE_ID" 2>/dev/null || echo "0")

if [ "$STAGED_COUNT" = "0" ]; then
    echo ""
    echo "Configuring node layout..."
    # Assign node to zone with 1GB capacity
    curl -sf -X POST "${GARAGE_ADMIN_URL}/v1/layout" \
        -H "Content-Type: application/json" \
        -d "{\"$NODE_ID\": {\"zone\": \"dc1\", \"capacity\": 1073741824, \"tags\": [\"pc2\"]}}" > /dev/null
    
    # Apply layout
    echo "Applying layout..."
    CURRENT_VERSION=$(curl -sf "${GARAGE_ADMIN_URL}/v1/layout" | grep -o '"version":[0-9]*' | cut -d':' -f2)
    NEW_VERSION=$((CURRENT_VERSION + 1))
    curl -sf -X POST "${GARAGE_ADMIN_URL}/v1/layout/apply" \
        -H "Content-Type: application/json" \
        -d "{\"version\": $NEW_VERSION}" > /dev/null
    echo "Layout applied!"
fi

# Create access key
echo ""
echo "Creating access key..."
KEY_RESPONSE=$(curl -sf -X POST "${GARAGE_ADMIN_URL}/v1/key" \
    -H "Content-Type: application/json" \
    -d '{"name": "pc2-pulumi"}' 2>/dev/null || echo "")

if [ -z "$KEY_RESPONSE" ]; then
    # Key might already exist, try to get it
    echo "Key might already exist, checking..."
    KEY_RESPONSE=$(curl -sf "${GARAGE_ADMIN_URL}/v1/key?search=pc2-pulumi" 2>/dev/null || echo "")
fi

ACCESS_KEY=$(echo "$KEY_RESPONSE" | grep -o '"accessKeyId":"[^"]*"' | cut -d'"' -f4)
SECRET_KEY=$(echo "$KEY_RESPONSE" | grep -o '"secretAccessKey":"[^"]*"' | cut -d'"' -f4)

if [ -n "$ACCESS_KEY" ] && [ -n "$SECRET_KEY" ]; then
    echo ""
    echo "=========================================="
    echo "ACCESS KEY CREATED - SAVE THESE VALUES!"
    echo "=========================================="
    echo "AWS_ACCESS_KEY_ID=$ACCESS_KEY"
    echo "AWS_SECRET_ACCESS_KEY=$SECRET_KEY"
    echo "=========================================="
else
    echo "WARNING: Could not extract keys. You may need to create them manually."
fi

# Create bucket
echo ""
echo "Creating bucket: $BUCKET_NAME..."
BUCKET_RESPONSE=$(curl -sf -X POST "${GARAGE_ADMIN_URL}/v1/bucket" \
    -H "Content-Type: application/json" \
    -d "{\"globalAlias\": \"$BUCKET_NAME\"}" 2>/dev/null || echo "")

BUCKET_ID=$(echo "$BUCKET_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$BUCKET_ID" ]; then
    # Bucket might already exist
    echo "Bucket might already exist, checking..."
    BUCKET_ID=$(curl -sf "${GARAGE_ADMIN_URL}/v1/bucket?globalAlias=$BUCKET_NAME" 2>/dev/null | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
fi

if [ -n "$BUCKET_ID" ] && [ -n "$ACCESS_KEY" ]; then
    echo "Granting access to bucket..."
    curl -sf -X POST "${GARAGE_ADMIN_URL}/v1/bucket/allow" \
        -H "Content-Type: application/json" \
        -d "{\"bucketId\": \"$BUCKET_ID\", \"accessKeyId\": \"$ACCESS_KEY\", \"permissions\": {\"read\": true, \"write\": true, \"owner\": true}}" > /dev/null
    echo "Access granted!"
fi

echo ""
echo "=== Garage initialization complete! ==="
echo ""
echo "Next steps:"
echo "1. Copy the AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to your .env file"
echo "2. Restart pc2-api container: docker compose restart pc2-api"
