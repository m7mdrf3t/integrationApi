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
exports.ResponseHandler = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class ResponseHandler {
    constructor(options = {}) {
        this.supabaseClient = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        this.options = Object.assign({ maxSize: 1000, storageMethod: 'database', chunkSize: 50000 }, options);
    }
    handleLargeResponse(responseData, userId, status) {
        return __awaiter(this, void 0, void 0, function* () {
            const responseSize = responseData.length;
            if (responseSize <= this.options.maxSize) {
                return {
                    summary: 'Response within size limit',
                    fullResponse: responseData,
                    responseSize,
                    storageMethod: 'direct'
                };
            }
            const responseId = `webhook_${Date.now()}_${userId}`;
            switch (this.options.storageMethod) {
                case 'database':
                    return yield this.storeInDatabase(responseData, userId, status, responseId);
                case 'file':
                    return yield this.storeInFile(responseData, userId, status, responseId);
                case 'both':
                    const dbResult = yield this.storeInDatabase(responseData, userId, status, responseId);
                    yield this.storeInFile(responseData, userId, status, responseId);
                    return dbResult;
                default:
                    return yield this.storeInDatabase(responseData, userId, status, responseId);
            }
        });
    }
    storeInDatabase(responseData, userId, status, responseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { error } = yield this.supabaseClient
                    .from('webhook_responses')
                    .insert({
                    id: responseId,
                    user_id: userId,
                    response_data: responseData,
                    status,
                    created_at: new Date().toISOString()
                });
                if (error) {
                    console.error('Error storing in database:', error);
                    throw error;
                }
                return {
                    summary: `Large response stored in database with ID: ${responseId}`,
                    fullResponse: responseId,
                    responseSize: responseData.length,
                    storageMethod: 'database'
                };
            }
            catch (error) {
                console.error('Database storage failed:', error);
                // Fallback to file storage
                return yield this.storeInFile(responseData, userId, status, responseId);
            }
        });
    }
    storeInFile(responseData, userId, status, responseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const uploadsDir = path_1.default.join(__dirname, '../uploads');
                if (!fs_1.default.existsSync(uploadsDir)) {
                    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
                }
                const filePath = path_1.default.join(uploadsDir, `${responseId}.json`);
                const fileData = {
                    id: responseId,
                    user_id: userId,
                    response_data: responseData,
                    status,
                    created_at: new Date().toISOString()
                };
                fs_1.default.writeFileSync(filePath, JSON.stringify(fileData, null, 2));
                return {
                    summary: `Large response stored in file: ${responseId}.json`,
                    fullResponse: responseId,
                    responseSize: responseData.length,
                    storageMethod: 'file'
                };
            }
            catch (error) {
                console.error('File storage failed:', error);
                throw error;
            }
        });
    }
    retrieveResponse(responseId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Try database first
            try {
                const { data, error } = yield this.supabaseClient
                    .from('webhook_responses')
                    .select('*')
                    .eq('id', responseId)
                    .single();
                if (!error && data) {
                    return data;
                }
            }
            catch (error) {
                console.log('Response not found in database, trying file...');
            }
            // Try file
            try {
                const filePath = path_1.default.join(__dirname, '../uploads', `${responseId}.json`);
                if (fs_1.default.existsSync(filePath)) {
                    const fileData = fs_1.default.readFileSync(filePath, 'utf8');
                    return JSON.parse(fileData);
                }
            }
            catch (error) {
                console.error('Error reading file:', error);
            }
            throw new Error('Response not found');
        });
    }
}
exports.ResponseHandler = ResponseHandler;
