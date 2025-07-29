"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dotenv_1 = __importDefault(require("dotenv")); // If you're using dotenv for local environment variables
// Load environment variables from .env file if in development
// In production, these should be set directly in your hosting environment
dotenv_1.default.config();
const router = (0, express_1.Router)();
router.post('/register', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // --- 1. Custom API Key Authentication ---
    const customKey = req.headers['x-drself-auth'];
    const expectedKey = process.env.DRSELF_API_KEY;
    if (!customKey || customKey !== expectedKey) {
        console.warn('Unauthorized access attempt: Invalid or missing x-drself-auth header.');
        return res.status(401).json({
            success: false,
            message: 'Unauthorized: Invalid or missing API key'
        });
    }
    // --- 2. Log and Validate Supabase Environment Variables (for debugging) ---
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
        console.error('SERVER CONFIG ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables.');
        return res.status(500).json({
            success: false,
            message: 'Server configuration error: Required environment variables are not set.'
        });
    }
    console.log('Using SUPABASE_URL:', supabaseUrl);
    // Log a truncated key for security, but ensure it's present
    console.log('Using SUPABASE_SERVICE_KEY (first 5 chars):', supabaseServiceKey.substring(0, 5) + '...');
    try {
        console.log('Attempting to call Edge Function with payload:', JSON.stringify(req.body, null, 2));
        // --- 3. Call the Supabase Edge Function ---
        const edgeFunctionResponse = yield fetch(`${supabaseUrl}/functions/v1/register-user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Ensure this key is correct and valid
                Authorization: `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify(req.body)
        });
        console.log('Edge function response status received:', edgeFunctionResponse.status);
        console.log('Edge function response headers received:', Object.fromEntries(edgeFunctionResponse.headers.entries()));
        // Read and log the raw response body
        const responseText = yield edgeFunctionResponse.text();
        console.log('Edge function raw response body:', responseText);
        // --- 4. Read and Parse Edge Function Response Body ---
        let parsedData;
        let statusCode = edgeFunctionResponse.status;
        try {
            // Try to parse as JSON first
            parsedData = JSON.parse(responseText);
            // Always include statusCode in the response body
            if (typeof parsedData === 'object' && parsedData !== null) {
                parsedData.statusCode = statusCode;
            }
        }
        catch (parseError) {
            // If not JSON, treat as string error message
            console.error('Received non-JSON response:', responseText);
            // Check for specific error messages and map to appropriate status codes
            if (responseText.includes('already has a buildup account')) {
                statusCode = 419;
                parsedData = {
                    success: false,
                    message: 'User already has a BuildUp account',
                    details: {
                        errorType: 'duplicate_user',
                        hasBuildup: true
                    },
                    statusCode
                };
            }
            else if (responseText.includes('User exists but does not have a BuildUp account')) {
                statusCode = 419;
                parsedData = {
                    success: false,
                    message: responseText,
                    details: {
                        errorType: 'existing_user_no_buildup',
                        hasBuildup: false
                    },
                    statusCode
                };
            }
            else {
                statusCode = 500;
                parsedData = {
                    success: false,
                    message: 'Unexpected error from Edge Function',
                    details: {
                        errorType: 'server_error',
                        rawMessage: responseText
                    },
                    statusCode
                };
            }
        }
        // --- 5. Forward the Edge Function's Status and Body ---
        console.log(`Edge function response status: ${statusCode}`);
        console.log('Edge Function Response:', parsedData);
        // Forward the status code and response from Edge Function
        return res.status(statusCode).json(parsedData);
    }
    catch (error) {
        // --- 6. Handle Network Errors or Unexpected Issues in Express Route ---
        // This catch block will ONLY be triggered if the `fetch` call itself fails
        // (e.g., network down, incorrect URL, DNS issue, or an uncaught error *before* fetch returns).
        console.error('CRITICAL ERROR: Failed to call Supabase Edge Function from Express:', error);
        // Return error response in the same format as Edge Function
        return res.status(500).json({
            success: false,
            message: 'Failed to communicate with Edge Function',
            details: error.message
        });
    }
}));
exports.default = router;
