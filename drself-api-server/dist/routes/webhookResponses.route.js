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
// Get webhook response by ID
router.get('/webhook-response/:responseId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { responseId } = req.params;
        const supabaseClient = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        const { data, error } = yield supabaseClient
            .from('webhook_responses')
            .select('*')
            .eq('id', responseId)
            .single();
        if (error) {
            return res.status(404).json({
                success: false,
                error: 'Webhook response not found',
                details: error.message
            });
        }
        // Mark as retrieved
        yield supabaseClient
            .from('webhook_responses')
            .update({ retrieved_at: new Date().toISOString() })
            .eq('id', responseId);
        return res.json({
            success: true,
            data: {
                id: data.id,
                user_id: data.user_id,
                response_data: data.response_data,
                status: data.status,
                created_at: data.created_at,
                retrieved_at: new Date().toISOString()
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
// List webhook responses for a user
router.get('/webhook-responses/:userId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.params;
        const { limit = 10, offset = 0 } = req.query;
        const supabaseClient = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        const { data, error } = yield supabaseClient
            .from('webhook_responses')
            .select('id, user_id, status, created_at, retrieved_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(Number(offset), Number(offset) + Number(limit) - 1);
        if (error) {
            return res.status(500).json({
                success: false,
                error: 'Error fetching webhook responses',
                details: error.message
            });
        }
        return res.json({
            success: true,
            data: data,
            pagination: {
                limit: Number(limit),
                offset: Number(offset),
                count: data.length
            }
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
