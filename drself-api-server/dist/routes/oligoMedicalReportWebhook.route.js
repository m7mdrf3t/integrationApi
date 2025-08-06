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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
// --- Supabase client for user profile lookup ---
const supabase_js_1 = require("@supabase/supabase-js");
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
// OAuth token cache
let cachedToken = null;
// Function to get OAuth token
function getOAuthToken() {
    return __awaiter(this, void 0, void 0, function* () {
        // Check if we have a valid cached token
        if (cachedToken && Date.now() < cachedToken.expiresAt) {
            return cachedToken.token;
        }
        try {
            console.log('Getting new OAuth token...');
            const tokenResponse = yield fetch('https://sts.x-inity.com/connect/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: 'client_id=dr_self&client_secret=]SKI8NAJaGrc1ai&grant_type=client_credentials'
            });
            if (!tokenResponse.ok) {
                throw new Error(`Token request failed: ${tokenResponse.status} ${tokenResponse.statusText}`);
            }
            const tokenData = yield tokenResponse.json();
            // Cache the token (expires in 1 hour, but we'll refresh after 50 minutes)
            const expiresAt = Date.now() + (50 * 60 * 1000); // 50 minutes
            cachedToken = {
                token: tokenData.access_token,
                expiresAt
            };
            console.log('OAuth token obtained successfully');
            return tokenData.access_token;
        }
        catch (error) {
            console.error('Error getting OAuth token:', error);
            throw error;
        }
    });
}
router.post('/oligo-medical-report-webhook', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('V1.0 - OLIGO MEDICAL REPORT WEBHOOK - Webhook triggered.');
    console.log('Oligo medical report webhook endpoint triggered');
    // Require custom auth header (same as other routes)
    const customKey = req.headers['x-drself-auth'];
    const expectedKey = process.env.DRSELF_API_KEY;
    if (!customKey || customKey !== expectedKey) {
        return res.status(401).json({ error: 'Authorization header required' });
    }
    try {
        const payload = req.body;
        console.log('Webhook payload received:', JSON.stringify(payload, null, 2));
        // Validate payload structure
        if (!payload.type || !payload.record) {
            return res.status(400).json({
                success: false,
                error: 'Invalid payload structure'
            });
        }
        // Only process INSERT and UPDATE events
        if (payload.type !== 'INSERT' && payload.type !== 'UPDATE') {
            return res.json({
                success: false,
                message: 'Event type not supported'
            });
        }
        // Check if we have the required fields
        console.log('DEBUG: Checking required fields...');
        console.log('DEBUG: payload.record.file_url:', payload.record.file_url);
        console.log('DEBUG: payload.record.user_id:', payload.record.user_id);
        console.log('DEBUG: payload.record keys:', Object.keys(payload.record));
        if (!payload.record.file_url || !payload.record.user_id) {
            console.log('DEBUG: Missing required fields detected');
            console.log('DEBUG: file_url exists:', !!payload.record.file_url);
            console.log('DEBUG: user_id exists:', !!payload.record.user_id);
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: file_url or user_id'
            });
        }
        const record = payload.record;
        console.log(`Processing ${payload.type} event for user: ${record.user_id}, file: ${record.file_url}`);
        // Get OAuth token
        const accessToken = yield getOAuthToken();
        // --- Start of Enhanced Mapping Logic ---
        // 1. Get user profile from Supabase (if needed)
        let userProfile = {};
        let userContact = {};
        try {
            // Fetch from 'medical_history' table (existing logic)
            console.log('=== MEDICAL HISTORY DEBUG ===');
            console.log('Querying medical_history for user_id:', record.user_id);
            const { data: userData, error: userError } = yield supabase
                .from('medical_history')
                .select('blood_type, gender, age, date_of_birth, weight_kg, height_m, blood_group, email, phone')
                .eq('user_id', record.user_id)
                .single();
            console.log('Medical history query result:', { userData, userError });
            if (!userError && userData) {
                userProfile = userData;
                console.log('Medical history data assigned to userProfile:', userProfile);
            }
            else {
                console.log('No medical history data found or error occurred');
            }
            // Fetch from 'profiles' table for number and email
            const { data: profileData, error: profileError } = yield supabase
                .from('profiles')
                .select('email, phone, buildup_user_id , gender, age, weight, height')
                .eq('id', record.user_id)
                .single();
            console.log('[DEBUG] Supabase profiles query result:', { profileData, profileError });
            // --- NEW: Hard failure if profile is not found ---
            if (profileError || !profileData) {
                console.error('CRITICAL: Could not find user profile in `profiles` table for user_id:', record.user_id);
                return res.status(404).json({
                    success: false,
                    error: `User profile not found for user_id: ${record.user_id}`
                });
            }
            userContact = profileData;
            // --- CRUCIAL: Check for buildup_user_id before proceeding ---
            if (!profileError && profileData && !profileData.buildup_user_id) {
                console.log('WARNING: User does not have a buildup_user_id. Skipping Buildup gateway call.');
                return res.status(200).json({
                    success: true,
                    event_type: payload.type,
                    user_id: record.user_id,
                    file_url: record.file_url,
                    message: 'Webhook processed successfully but Buildup gateway call skipped due to missing buildup_user_id',
                    buildup_gateway_status: 'SKIPPED',
                    buildup_gateway_response: 'User does not have buildup_user_id',
                    sent_payload: null
                });
            }
        }
        catch (err) {
            console.warn('Could not fetch user profile or contact:', err);
        }
        // Parse ivDrip as array of objects { name, dosage, frequency }
        let ivDripArray = [];
        if (record.iv_drip) {
            try {
                // For Oligo, iv_drip is a simple string like "Detox Drip 750"
                const parts = record.iv_drip.trim().split(' ');
                if (parts.length >= 2) {
                    const dosage = parts[parts.length - 1]; // Last part is dosage
                    const name = parts.slice(0, -1).join(' '); // Everything except last part is name
                    ivDripArray = [{
                            name: name,
                            dosage: dosage,
                            frequency: 'Once'
                        }];
                }
                else {
                    ivDripArray = [{
                            name: record.iv_drip,
                            dosage: '',
                            frequency: 'Once'
                        }];
                }
            }
            catch (e) {
                console.error("Error parsing iv_drip:", e);
                ivDripArray = [];
            }
        }
        // Parse foodSupplement as array of objects { name, dosage, frequency }
        let foodSupplementArray = [];
        if (record.food_supplement) {
            console.log('=== FOOD SUPPLEMENT PARSING DEBUG ===');
            console.log('Original food_supplement:', record.food_supplement);
            try {
                const parsed = JSON.parse(record.food_supplement);
                console.log('Parsed JSON:', parsed);
                if (Array.isArray(parsed)) {
                    foodSupplementArray = parsed.map((item) => {
                        console.log('Processing item:', item, 'Type:', typeof item);
                        // For Oligo, items are objects with name, dosage, frequency
                        if (typeof item === 'object' && item !== null) {
                            const result = {
                                name: item.name || '',
                                dosage: item.dosage || '',
                                frequency: item.frequency || ''
                            };
                            console.log('Object result:', result);
                            return result;
                        }
                        return { name: '', dosage: '', frequency: '' };
                    });
                }
                else {
                    foodSupplementArray = [];
                }
            }
            catch (e) {
                console.error("Error parsing food_supplement:", e);
                foodSupplementArray = [];
            }
            console.log('Final foodSupplementArray:', JSON.stringify(foodSupplementArray, null, 2));
        }
        // Parse providerFindings from life_style (Oligo format)
        let providerFindings = [];
        if (record.life_style) {
            try {
                const parsed = JSON.parse(record.life_style);
                if (Array.isArray(parsed)) {
                    providerFindings = parsed.map((item) => {
                        const displayTitle = item.category || 'Title to be displayed in mobile';
                        const shortDescription = `${item.category} ${item.status}`;
                        const longDescription = `${item.category} ${item.status}`;
                        // Extract symptoms array
                        const symptoms = Array.isArray(item.symptoms) ? item.symptoms : [];
                        // Extract recommendations from steps array
                        const recommendations = Array.isArray(item.steps) ? item.steps : [];
                        return {
                            displayTitle,
                            shortDescription,
                            description: longDescription,
                            longDescription,
                            symptoms,
                            recommendationDisplayTitle: displayTitle,
                            recommendations
                        };
                    });
                }
            }
            catch (e) {
                console.error("Error parsing life_style:", e);
                providerFindings = [];
            }
        }
        // Parse providerRecommendations from Life_recommendation (Oligo format)
        let providerRecommendationsArray = [];
        if (record.Life_recommendation) {
            try {
                const parsed = JSON.parse(record.Life_recommendation);
                if (Array.isArray(parsed)) {
                    providerRecommendationsArray = parsed.map((category) => {
                        const recommendations = [];
                        if (Array.isArray(category.recommendations)) {
                            category.recommendations.forEach((rec) => {
                                if (rec.condition && rec.symptoms && rec.sources) {
                                    const recommendationText = `${rec.condition}\nS & S include:\n${rec.symptoms.join(', ')}\n${rec.condition} sources:\n${rec.sources.join(', ')}`;
                                    recommendations.push(recommendationText);
                                }
                                else if (rec.condition && rec.symptoms) {
                                    const recommendationText = `${rec.condition}\nS&S may include:\n${rec.symptoms.join(', ')}`;
                                    recommendations.push(recommendationText);
                                }
                            });
                        }
                        return {
                            title: category.title || '',
                            recommendation: recommendations
                        };
                    });
                }
            }
            catch (e) {
                console.error("Error parsing Life_recommendation:", e);
                providerRecommendationsArray = [];
            }
        }
        // Helper function to format dates to ISO 8601
        const formatToISO = (dateString) => {
            if (!dateString)
                return null;
            try {
                return new Date(dateString).toISOString();
            }
            catch (_a) {
                return dateString; // Return original if parsing fails
            }
        };
        // Build patientInfo and scanInfo
        console.log('=== PATIENT INFO MAPPING DEBUG ===');
        console.log('userProfile.blood_group:', userProfile.blood_group);
        console.log('record.blood_group:', record.blood_group);
        console.log('userProfile:', userProfile);
        console.log('userContact:', userContact);
        const patientInfo = {
            email: userContact.email || userProfile.email || record.email || null,
            userId: userContact.buildup_user_id,
            gender: userContact.gender || userProfile.gender || record.gender || null,
            age: userContact.age || userProfile.age || record.age || null,
            dateOfBirth: formatToISO(userContact.date_of_birth || userProfile.date_of_birth || record.date_of_birth),
            dateOfTest: formatToISO(record.created_at),
            bloodGroup: userProfile.blood_type || record.blood_group || null,
            weightKg: userContact.weight || userProfile.weight_kg || record.weight_kg || null,
            heightM: userContact.height || userProfile.height_m || record.height_m || null
        };
        console.log('Final patientInfo.bloodGroup:', patientInfo.bloodGroup);
        // Debug scanInfo mapping
        console.log('=== SCAN INFO DEBUG ===');
        console.log('record.description:', record.description);
        console.log('record.title:', record.title);
        console.log('record.report_date:', record.report_date);
        console.log('record.summary_status:', record.summary_status);
        console.log('record.summary:', record.summary);
        console.log('record.doctor_name:', record.doctor_name);
        console.log('record.hospital_name:', record.hospital_name);
        console.log('record.file_url:', record.file_url);
        const scanInfo = {
            title: record.title,
            description: record.description,
            reportDate: formatToISO(record.report_date),
            summaryStatus: record.summary_status,
            summary: record.summary,
            summaryGeneratedAt: formatToISO(record.summary_generated_at),
            doctorName: record.doctor_name,
            hospitalName: record.hospital_name,
            fileUrl: record.file_url,
            oligoUrl: record.file_url // Add oligoUrl field - same as fileUrl for Oligo reports
        };
        console.log('Final scanInfo:', scanInfo);
        // Compose the final nested payload
        const buildupPayload = {
            id: record.id,
            patientInfo,
            scanInfo,
            ivDrip: ivDripArray,
            foodSupplement: foodSupplementArray,
            providerFindings,
            providerRecommendations: providerRecommendationsArray
        };
        // --- End of Unified Mapping Logic ---
        // Final safety check: Ensure user has buildup_user_id before sending to gateway
        if (!userContact.buildup_user_id) {
            console.log('FINAL CHECK: User does not have buildup_user_id. Skipping Buildup gateway call.');
            return res.json({
                success: true,
                event_type: payload.type,
                user_id: record.user_id,
                file_url: record.file_url,
                message: 'Webhook processed successfully but Buildup gateway call skipped due to missing buildup_user_id',
                buildup_gateway_status: 'SKIPPED',
                buildup_gateway_response: 'User does not have buildup_user_id',
                sent_payload: null
            });
        }
        // Check if all required parameters are present
        const requiredParameters = {
            life_style: record.life_style,
            food_supplement: record.food_supplement,
            Life_recommendation: record.Life_recommendation
        };
        const missingParameters = Object.entries(requiredParameters)
            .filter(([key, value]) => !value || value === null || value === undefined || value === '')
            .map(([key]) => key);
        if (missingParameters.length > 0) {
            console.log('FINAL CHECK: Missing required parameters. Skipping Buildup gateway call.');
            console.log('Missing parameters:', missingParameters);
            return res.json({
                success: true,
                event_type: payload.type,
                user_id: record.user_id,
                file_url: record.file_url,
                message: `Webhook processed successfully but Buildup gateway call skipped due to missing required parameters: ${missingParameters.join(', ')}`,
                buildup_gateway_status: 'SKIPPED',
                buildup_gateway_response: `Missing required parameters: ${missingParameters.join(', ')}`,
                sent_payload: null,
                missing_parameters: missingParameters
            });
        }
        console.log('Sending mapped payload to Buildup gateway:', JSON.stringify(buildupPayload, null, 2));
        // Send to Buildup gateway
        const webhookResponse = yield fetch('https://buildup-gateway.x-inity.com/IntegrationAPI/v1/HealthInsights/Submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(buildupPayload)
        });
        const webhookResult = yield webhookResponse.text();
        console.log('Buildup gateway response:', {
            status: webhookResponse.status,
            statusText: webhookResponse.statusText,
            body: webhookResult
        });
        // Return response with nested payload
        return res.json({
            success: true,
            event_type: payload.type,
            user_id: record.user_id,
            file_url: record.file_url,
            buildup_gateway_status: webhookResponse.status,
            buildup_gateway_response: webhookResult,
            sent_payload: buildupPayload
        });
    }
    catch (error) {
        console.error('Error processing webhook:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));
function stripHtmlAndNormalize(html) {
    return html
        .replace(/<[^>]*>/g, '') // Remove all HTML tags
        .replace(/\s+/g, ' ') // Replace multiple spaces/newlines with a single space
        .trim(); // Trim leading/trailing whitespace
}
function decodeHtmlEntities(text) {
    const entities = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#039;': "'"
    };
    return text.replace(/&[#]?\w+;/g, (match) => entities[match] || match);
}
exports.default = router;
