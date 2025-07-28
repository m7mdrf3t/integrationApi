#!/bin/bash

# Debug script for register endpoint
# Make sure to set your DRSELF_API_KEY environment variable

API_KEY="${DRSELF_API_KEY:-your-api-key-here}"
BASE_URL="http://localhost:3000"  # Change this to your server URL

echo "=== Testing Register Endpoint Debug ==="
echo "API Key: $API_KEY"
echo "Base URL: $BASE_URL"
echo ""

# Test payload
PAYLOAD='{
  "fullName": "Test User",
  "email": "test@example.com",
  "buildupUserId": "test-buildup-123"
}'

echo "Request payload:"
echo "$PAYLOAD"
echo ""

echo "=== Making Request ==="
# Make the request with verbose output
curl -X POST \
  "${BASE_URL}/api/v1/register" \
  -H "Content-Type: application/json" \
  -H "x-drself-auth: $API_KEY" \
  -d "$PAYLOAD" \
  -v \
  -w "\n\n=== Response Summary ===\nHTTP Status: %{http_code}\nTotal Time: %{time_total}s\n"

echo ""
echo "=== Debug Complete ===" 