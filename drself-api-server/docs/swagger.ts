import swaggerJSDoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Dr.Self API Middleware',
      version: '1.0.0',
      description: 'API middleware between Supabase Edge Functions and external consumers (v1 integration)',
    },
  },
  apis: ['./routes/*.ts'], // Path to the API docs
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
