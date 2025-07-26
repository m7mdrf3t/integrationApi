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
const supabase_js_1 = require("@supabase/supabase-js");
const router = (0, express_1.Router)();
router.post('/medical-report-webhook', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authHeader = req.headers['authorization'];
        if (!authHeader) {
            return res.status(401).json({ error: 'Authorization header required' });
        }
        const supabaseClient = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
            global: {
                headers: {
                    Authorization: authHeader
                }
            }
        });
        const payload = req.body;
        console.log('Webhook payload received:', JSON.stringify(payload, null, 2));
        if ((payload.type === 'INSERT' || payload.type === 'UPDATE') && payload.record && payload.record.file_url) {
            const fileUrl = payload.record.file_url;
            const userId = payload.record.user_id;
            console.log(`Processing record for user: ${userId}, file: ${fileUrl}`);
            if (!userId) {
                console.log('No user_id found in the medical report');
                return res.status(400).json({ success: false, error: 'No user_id found' });
            }
            const { data: profileData, error: profileError } = yield supabaseClient
                .from('profiles')
                .select('buildup_user_id')
                .eq('id', userId)
                .single();
            if (profileError) {
                console.error('Error fetching profile:', profileError);
                return res.status(500).json({ success: false, error: 'Profile fetch error', details: profileError.message });
            }
            if (profileData && profileData.buildup_user_id) {
                console.log(`Valid update detected for user with buildup_user_id: ${profileData.buildup_user_id}`);
                try {
                    const webhookResponse = yield fetch('https://n8n-railway-production-53dd.up.railway.app/webhook/buildup', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            UserID: userId,
                            fileUrl: fileUrl,
                            buildup_user_id: profileData.buildup_user_id
                        })
                    });
                    const webhookResult = yield webhookResponse.text();
                    console.log('Webhook response:', webhookResult);
                    console.log('Webhook status:', webhookResponse.status);
                    return res.json({
                        success: true,
                        url: fileUrl,
                        webhook_called: true,
                        webhook_response: webhookResult,
                        webhook_status: webhookResponse.status
                    });
                }
                catch (webhookError) {
                    console.error('Error calling webhook:', webhookError);
                    return res.status(500).json({
                        success: false,
                        url: fileUrl,
                        webhook_called: false,
                        webhook_error: webhookError.message
                    });
                }
            }
            else {
                console.log('User does not have a buildup_user_id in profiles');
                return res.json({
                    success: false,
                    message: 'User does not have buildup_user_id'
                });
            }
        }
        else {
            console.log('No file_url found or invalid event type');
            return res.json({
                success: false,
                message: 'No file_url found or invalid event type'
            });
        }
    }
    catch (error) {
        console.error('Error:', error);
        return res.status(500).json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}));
exports.default = router;
