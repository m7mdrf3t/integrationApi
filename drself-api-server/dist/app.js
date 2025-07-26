"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
// import cors from 'cors';
const dotenv_1 = __importDefault(require("dotenv"));
const registerUser_route_1 = __importDefault(require("./routes/registerUser.route"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const yamljs_1 = __importDefault(require("yamljs"));
const medicalReportWebhook_route_1 = __importDefault(require("./routes/medicalReportWebhook.route"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
// app.use(cors());
app.use(express_1.default.json());
// API v1 routes
app.use('/api/v1', registerUser_route_1.default);
app.use('/api/v1', medicalReportWebhook_route_1.default);
// Serve the raw YAML file
app.get('/api/v1/docs/yaml', (req, res) => {
    const yamlPath = path_1.default.join(__dirname, 'docs', 'swagger.yaml');
    res.type('text/yaml').send(fs_1.default.readFileSync(yamlPath, 'utf8'));
});
// Serve Swagger UI from YAML
const swaggerDocument = yamljs_1.default.load(path_1.default.join(__dirname, 'docs', 'swagger.yaml'));
app.use('/api/v1/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerDocument));
exports.default = app;
