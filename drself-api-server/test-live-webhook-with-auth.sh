#!/bin/bash

echo "🧪 Testing LIVE Medical Report Webhook with Auth Headers..."
echo "🌐 Endpoint: https://integrationapi-production.up.railway.app/api/v1/medical-report-webhook"
echo ""

# Test payload with all parameters
PAYLOAD='{
  "type": "UPDATE",
  "table": "medical_reports",
  "record": {
    "id": "5ba55b4a-a980-49e6-82eb-b7a84ad17a36",
    "title": "Mahfouz_7_2_25",
    "status": "completed",
    "iv_drip": "bjvhvghv",
    "summary": null,
    "user_id": "23d2bf91-f9d0-4a20-901c-59f2b7b1bacb",
    "file_url": "https://lluclyumbgjzcfkuyblg.supabase.co/storage/v1/object/public/medical-reports/23d2bf91-f9d0-4a20-901c-59f2b7b1bacb/1753569790450_Mahfouz_7_2_25.pdf",
    "diet_plan": "Low carb diet",
    "blood_test": "fdfdf",
    "created_at": "2025-07-26T22:43:10.988526+00:00",
    "life_style": "Active lifestyle",
    "updated_at": "2025-07-26T23:19:56.60343+00:00",
    "description": "build up",
    "doctor_name": "Dr. Smith",
    "report_date": "2025-07-26",
    "hospital_name": "City Hospital",
    "summary_status": "pending",
    "food_supplement": "Vitamin D, Omega-3",
    "life_recommendation": "Exercise regularly",
    "summary_generated_at": null
  },
  "schema": "public",
  "old_record": {
    "id": "5ba55b4a-a980-49e6-82eb-b7a84ad17a36",
    "title": "Mahfouz_7_2_25",
    "status": "completed",
    "iv_drip": "bjvhvghv",
    "summary": null,
    "user_id": "23d2bf91-f9d0-4a20-901c-59f2b7b1bacb",
    "file_url": "https://lluclyumbgjzcfkuyblg.supabase.co/storage/v1/object/public/medical-reports/23d2bf91-f9d0-4a20-901c-59f2b7b1bacb/1753569790450_Mahfouz_7_2_25.pdf",
    "diet_plan": "",
    "blood_test": "",
    "created_at": "2025-07-26T22:43:10.988526+00:00",
    "life_style": "",
    "updated_at": "2025-07-26T22:51:36.099287+00:00",
    "description": "build up",
    "doctor_name": null,
    "report_date": "2025-07-26",
    "hospital_name": null,
    "summary_status": "pending",
    "food_supplement": "",
    "life_recommendation": "",
    "summary_generated_at": null
  }
}'

echo "📤 Sending payload to LIVE webhook with auth headers..."
echo "Payload: $PAYLOAD"
echo ""

# Test 1: With API Key header
echo "🔑 Test 1: With API Key header..."
curl -X POST \
  https://integrationapi-production.up.railway.app/api/v1/medical-report-webhook \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-key" \
  -d "$PAYLOAD" \
  -w "\n\nHTTP Status: %{http_code}\nTotal Time: %{time_total}s\nResponse Size: %{size_download} bytes\n"

echo ""
echo ""

# Test 2: With Bearer token
echo "🔑 Test 2: With Bearer token..."
curl -X POST \
  https://integrationapi-production.up.railway.app/api/v1/medical-report-webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d "$PAYLOAD" \
  -w "\n\nHTTP Status: %{http_code}\nTotal Time: %{time_total}s\nResponse Size: %{size_download} bytes\n"

echo ""
echo ""

# Test 3: With webhook secret
echo "🔑 Test 3: With webhook secret..."
curl -X POST \
  https://integrationapi-production.up.railway.app/api/v1/medical-report-webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: test-secret" \
  -d "$PAYLOAD" \
  -w "\n\nHTTP Status: %{http_code}\nTotal Time: %{time_total}s\nResponse Size: %{size_download} bytes\n"

echo ""
echo "✅ Live webhook auth tests completed!" 