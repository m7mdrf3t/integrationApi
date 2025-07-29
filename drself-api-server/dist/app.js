"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
// import cors from 'cors';
const dotenv_1 = __importDefault(require("dotenv"));
const registerUser_route_1 = __importDefault(require("./routes/registerUser.route"));
const updateBuildUpUserId_route_1 = __importDefault(require("./routes/updateBuildUpUserId.route"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const yamljs_1 = __importDefault(require("yamljs"));
const medicalReportWebhook_route_1 = __importDefault(require("./routes/medicalReportWebhook.route"));
const webhookResponses_route_1 = __importDefault(require("./routes/webhookResponses.route"));
const debug_route_1 = __importDefault(require("./routes/debug.route"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
// --- DEBUG: Log every incoming request ---
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.originalUrl}`);
    next();
});
// app.use(cors());
app.use(express_1.default.json());
// API v1 routes
app.use('/api/v1', registerUser_route_1.default);
app.use('/api/v1', updateBuildUpUserId_route_1.default);
app.use('/api/v1', medicalReportWebhook_route_1.default);
app.use('/api/v1', webhookResponses_route_1.default);
app.use('/api/v1', debug_route_1.default);
// Serve the raw YAML file
app.get('/api/v1/docs/yaml', (req, res) => {
    const yamlPath = path_1.default.join(__dirname, 'docs', 'swagger.yaml');
    res.type('text/yaml').send(fs_1.default.readFileSync(yamlPath, 'utf8'));
});
// Serve Swagger UI from YAML
const swaggerDocument = yamljs_1.default.load(path_1.default.join(__dirname, 'docs', 'swagger.yaml'));
app.use('/api/v1/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerDocument));
// --- DEBUG: Print all registered routes ---
if (app._router && app._router.stack) {
    console.log('\n[Registered Express Routes]');
    app._router.stack
        .filter((r) => r.route)
        .forEach((r) => {
        const route = r.route;
        const methods = Object.keys(route.methods).map(m => m.toUpperCase()).join(', ');
        console.log(`[${methods}] ${route.path}`);
    });
    console.log('[End of Route List]\n');
}
// --- DEBUG: Print all registered routes (robust recursive) ---
try {
    if (typeof app === 'function' && app._router && app._router.stack) {
        function printRoutes(stack, prefix = '') {
            for (const layer of stack) {
                if (layer.route && layer.route.path) {
                    const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase()).join(', ');
                    console.log(`[${methods}] ${prefix}${layer.route.path}`);
                }
                else if (layer.name === 'router' && layer.handle.stack) {
                    const newPrefix = prefix + (layer.regexp.source === '^\\/\\?' ? '' : layer.regexp.source
                        .replace('^\\/', '/')
                        .replace('\\/?', '')
                        .replace('(?=\\/|$)', '')
                        .replace('^', '')
                        .replace('$', ''));
                    printRoutes(layer.handle.stack, newPrefix);
                }
            }
        }
        console.log('\n[Registered Express Routes]');
        printRoutes(app._router.stack);
        console.log('[End of Route List]\n');
    }
    else {
        console.log('[Route Debug] app._router or app._router.stack not available.');
    }
}
catch (err) {
    console.error('[Route Debug] Failed to print routes:', err);
}
exports.default = app;
