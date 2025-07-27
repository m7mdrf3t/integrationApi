import express from 'express';
// import cors from 'cors';
import dotenv from 'dotenv';
import registerUserRouter from './routes/registerUser.route';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './docs/swagger';
import path from 'path';
import fs from 'fs';
import YAML from 'yamljs';
import medicalReportWebhookRouter from './routes/medicalReportWebhook.route';
import webhookResponsesRouter from './routes/webhookResponses.route';
import debugRouter from './routes/debug.route';

// Load environment variables
dotenv.config();

const app = express();

// app.use(cors());
app.use(express.json());

// API v1 routes
app.use('/api/v1', registerUserRouter);
app.use('/api/v1', medicalReportWebhookRouter);
app.use('/api/v1', webhookResponsesRouter);
app.use('/api/v1', debugRouter);

// Serve the raw YAML file
app.get('/api/v1/docs/yaml', (req, res) => {
  const yamlPath = path.join(__dirname, 'docs', 'swagger.yaml');
  res.type('text/yaml').send(fs.readFileSync(yamlPath, 'utf8'));
});

// Serve Swagger UI from YAML
const swaggerDocument = YAML.load(path.join(__dirname, 'docs', 'swagger.yaml'));
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

export default app;
