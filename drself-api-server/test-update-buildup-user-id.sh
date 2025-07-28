#!/bin/bash

# Test script for update-buildup-user-id endpoint
# Make sure to set your DRSELF_API_KEY environment variable

API_KEY="${DRSELF_API_KEY:-your-api-key-here}"
BASE_URL="http://localhost:3000"  # Change this to your server URL

echo "Testing update-buildup-user-id endpoint..."
echo "API Key: $API_KEY"
echo "Base URL: $BASE_URL"
echo ""

# Test payload
PAYLOAD='{
  "email": "test@example.com",
  "phoneNumber": "1234567890",
  "buildUp_user_id": "test-id-123"
}'

echo "Request payload:"
echo "$PAYLOAD"
echo ""

# Make the request
curl -X POST \
  "${BASE_URL}/api/v1/update-buildup-user-id" \
  -H "Content-Type: application/json" \
  -H "x-drself-auth: $API_KEY" \
  -d "$PAYLOAD" \
  -w "\n\nHTTP Status: %{http_code}\nTotal Time: %{time_total}s\n"

echo ""
echo "Test completed!" 