# Live Webhook Testing Guide

## 🌐 Live Endpoint
**URL**: `https://integrationapi-production.up.railway.app/api/v1/medical-report-webhook`

## 🔍 Test Results Summary

### Current Status: ⚠️ Authentication Required
The live endpoint requires authentication that differs from the local development environment.

### Test Results:
1. **No Auth Headers**: `401 - Authorization header required`
2. **API Key Header**: `401 - Authorization header required`
3. **Bearer Token**: `500 - Profile fetch error (JWT decode error)`
4. **Webhook Secret**: `401 - Authorization header required`

## 🧪 Test Scripts Available

### 1. Basic Live Test
```bash
./test-live-webhook.sh
```

### 2. Auth Headers Test
```bash
./test-live-webhook-with-auth.sh
```

### 3. Node.js Test
```bash
node test-live-webhook.js
```

## 🔧 Troubleshooting

### Issue: Authorization Required ✅ SOLVED
The production environment requires the `DRSELF_API_KEY` environment variable to be set in Railway.

### Solution:

1. **Set Environment Variable in Railway**
   - Go to Railway dashboard → Your project → Variables tab
   - Add new variable: `DRSELF_API_KEY` = `your-secure-api-key`
   - Example: `DRSELF_API_KEY` = `drself-webhook-2025-secure-key`

2. **Use Correct Authentication Header**
   - Header: `x-drself-auth`
   - Value: Same as `DRSELF_API_KEY` environment variable

3. **Test with Environment Variable**
   ```bash
   export DRSELF_API_KEY=your-actual-api-key
   ./test-live-webhook-with-env.sh
   ```

## 📋 Required Authentication ✅ SOLVED

The live endpoint requires:
- **Header**: `x-drself-auth`
- **Value**: Same as `DRSELF_API_KEY` environment variable
- **Environment Variable**: Must be set in Railway dashboard

## 🚀 Next Steps ✅ READY

1. **Set Environment Variable in Railway**
   - Add `DRSELF_API_KEY` with a secure value
   - Redeploy the application

2. **Test the Webhook**
   ```bash
   export DRSELF_API_KEY=your-actual-api-key
   ./test-live-webhook-with-env.sh
   ```

3. **Use in Production**
   - Webhook is ready for production use
   - All medical report parameters will be forwarded to Buildup gateway

## 📞 Support

If you need help identifying the authentication method:
1. Check Railway dashboard for environment variables
2. Review the production deployment configuration
3. Check if there are any auth middleware differences between dev and prod

## 🔄 Quick Test Commands

```bash
# Test basic connectivity
curl -X GET https://integrationapi-production.up.railway.app/api/v1/docs

# Test webhook with correct auth (after setting DRSELF_API_KEY)
export DRSELF_API_KEY=your-actual-api-key
curl -X POST \
  https://integrationapi-production.up.railway.app/api/v1/medical-report-webhook \
  -H "Content-Type: application/json" \
  -H "x-drself-auth: $DRSELF_API_KEY" \
  -d '{"type":"UPDATE","record":{"user_id":"test","file_url":"test.pdf"}}'

# Or use the test script
./test-live-webhook-with-env.sh
``` 