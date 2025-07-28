# Medical Report Webhook Testing Guide

## Overview
The medical report webhook receives payloads from internal triggers and forwards relevant data to the Buildup gateway.

## Prerequisites
1. Make sure the server is running: `npm run dev`
2. The server should be accessible at `http://localhost:3000`

## Testing Methods

### Method 1: Using the Shell Script (Recommended)
```bash
./test-medical-webhook.sh
```

### Method 2: Using Node.js Script
```bash
node test-medical-webhook-simple.js
```

### Method 3: Using curl directly
```bash
curl -X POST \
  http://localhost:3000/api/v1/medical-report-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "UPDATE",
    "table": "medical_reports",
    "record": {
      "id": "5ba55b4a-a980-49e6-82eb-b7a84ad17a36",
      "title": "Mahfouz_7_2_25",
      "status": "completed",
      "user_id": "23d2bf91-f9d0-4a20-901c-59f2b7b1bacb",
      "file_url": "https://lluclyumbgjzcfkuyblg.supabase.co/storage/v1/object/public/medical-reports/23d2bf91-f9d0-4a20-901c-59f2b7b1bacb/1753569790450_Mahfouz_7_2_25.pdf",
      "description": "build up"
    }
  }'
```

## Expected Response
A successful response should look like:
```json
{
  "success": true,
  "event_type": "UPDATE",
  "user_id": "23d2bf91-f9d0-4a20-901c-59f2b7b1bacb",
  "file_url": "https://lluclyumbgjzcfkuyblg.supabase.co/storage/v1/object/public/medical-reports/23d2bf91-f9d0-4a20-901c-59f2b7b1bacb/1753569790450_Mahfouz_7_2_25.pdf",
  "buildup_gateway_status": 200,
  "buildup_gateway_response": "...",
  "sent_payload": {
    "file_url": "...",
    "user_id": "...",
    "title": "...",
    "status": "...",
    "description": "...",
    "event_type": "UPDATE",
    "timestamp": "..."
  }
}
```

## What the Webhook Does
1. **Receives** webhook payload from internal triggers
2. **Validates** payload structure and required fields
3. **Gets OAuth token** from STS endpoint (cached for efficiency)
4. **Extracts** relevant data (file_url, user_id, title, status, description)
5. **Sends** to Buildup gateway with proper authentication
6. **Returns** response with status and details

## Troubleshooting
- Check server logs for detailed error messages
- Verify OAuth credentials are correct
- Ensure Buildup gateway endpoint is accessible
- Check that required fields (file_url, user_id) are present in payload 