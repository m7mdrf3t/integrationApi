#!/bin/bash

echo "🧪 Testing Medical Report Webhook..."

# Test payload
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
    "diet_plan": "",
    "blood_test": "fdfdf",
    "created_at": "2025-07-26T22:43:10.988526+00:00",
    "life_style": "",
    "updated_at": "2025-07-26T23:19:56.60343+00:00",
    "description": "build up",
    "doctor_name": null,
    "report_date": "2025-07-26",
    "hospital_name": null,
    "summary_status": "pending",
    "food_supplement": "",
    "life_recommendation": "",
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

echo "📤 Sending payload to webhook..."
echo "Payload: $PAYLOAD"
echo ""

# Make the request
curl -X POST \
  http://localhost:3000/api/v1/medical-report-webhook \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  -w "\n\nHTTP Status: %{http_code}\nTotal Time: %{time_total}s\n"

echo ""
echo "✅ Test completed!" 