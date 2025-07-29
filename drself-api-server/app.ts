import express from 'express';
// import cors from 'cors';
import dotenv from 'dotenv';
import registerUserRouter from './routes/registerUser.route';
import updateBuildUpUserIdRouter from './routes/updateBuildUpUserId.route';
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

// --- DEBUG: Log every incoming request ---
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.originalUrl}`);
  next();
});

// app.use(cors());
app.use(express.json());

// API v1 routes
app.use('/api/v1', registerUserRouter);
app.use('/api/v1', updateBuildUpUserIdRouter);
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

// --- DEBUG: Print all registered routes ---
if (app._router && app._router.stack) {
  console.log('\n[Registered Express Routes]');
  app._router.stack
    .filter((r: any) => r.route)
    .forEach((r: any) => {
      const route = r.route;
      const methods = Object.keys(route.methods).map(m => m.toUpperCase()).join(', ');
      console.log(`[${methods}] ${route.path}`);
    });
  console.log('[End of Route List]\n');
}

// --- DEBUG: Print all registered routes (robust recursive) ---
try {
  if (typeof app === 'function' && app._router && app._router.stack) {
    function printRoutes(stack: any[], prefix = '') {
      for (const layer of stack) {
        if (layer.route && layer.route.path) {
          const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase()).join(', ');
          console.log(`[${methods}] ${prefix}${layer.route.path}`);
        } else if (layer.name === 'router' && layer.handle.stack) {
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
  } else {
    console.log('[Route Debug] app._router or app._router.stack not available.');
  }
} catch (err) {
  console.error('[Route Debug] Failed to print routes:', err);
}

export default app;
