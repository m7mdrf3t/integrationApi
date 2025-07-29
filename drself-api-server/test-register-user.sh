#!/bin/bash

# Exit on error
echo "🧪 Testing User Registration..."

# Test payload
PAYLOAD='{
  "fullName": "John Doe",
  "email": "john.doe@example.com",
  "buildupUserId": "buildup_test_123"
}'

echo "Sending registration request..."
echo "Payload: $PAYLOAD"
echo ""

# Make the request
curl -X POST \
  http://localhost:3000/api/v1/register \
  -H "Content-Type: application/json" \
  -H "x-drself-auth: drself_sk_4e7b1c2f8a9d4e3b9f6a1b2c3d4e5f6a" \
  -d "$PAYLOAD" \
  -w "\n\nHTTP Status: %{http_code}\nTotal Time: %{time_total}s\n"

echo "\n✅ Test completed!"
