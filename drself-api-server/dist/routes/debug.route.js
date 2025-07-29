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
// Get the latest webhook response for debugging
router.get('/debug/latest-webhook-response', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const supabaseClient = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        // Get the latest webhook response
        const { data, error } = yield supabaseClient
            .from('webhook_responses')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        if (error) {
            return res.json({
                success: false,
                message: 'No webhook responses found',
                error: error.message
            });
        }
        return res.json({
            success: true,
            data: {
                id: data.id,
                user_id: data.user_id,
                response_data: data.response_data,
                status: data.status,
                created_at: data.created_at
            }
        });
    }
    catch (error) {
        console.error('Error retrieving webhook response:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));
// Get all webhook responses for a specific user
router.get('/debug/webhook-responses/:userId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.params;
        const supabaseClient = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        const { data, error } = yield supabaseClient
            .from('webhook_responses')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (error) {
            return res.status(500).json({
                success: false,
                error: 'Error fetching webhook responses',
                details: error.message
            });
        }
        return res.json({
            success: true,
            count: data.length,
            responses: data.map(item => ({
                id: item.id,
                user_id: item.user_id,
                status: item.status,
                created_at: item.created_at,
                response_preview: item.response_data ? item.response_data.substring(0, 200) + '...' : 'No data'
            }))
        });
    }
    catch (error) {
        console.error('Error listing webhook responses:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));
exports.default = router;
