const swaggerUi = require('swagger-ui-express');

const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Pharmacy Management System Enterprise API',
    version: '1.0.0',
    description: 'ACID-compliant, FEFO inventory, server-side RBAC, POS checkout, stock reconciliation, and audit trail API.',
    contact: {
      name: 'Pharmacy Engineering Team',
      email: 'tech@pharmacy.local',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'Primary REST API v1',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          username: { type: 'string' },
          fullName: { type: 'string' },
          role: { type: 'string', enum: ['ADMIN', 'PHARMACIST', 'CASHIER'] },
          email: { type: 'string' },
        },
      },
      Medicine: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          sku: { type: 'string' },
          name: { type: 'string' },
          generic_name: { type: 'string' },
          category_id: { type: 'integer' },
          category_name: { type: 'string' },
          dosage_form: { type: 'string' },
          strength: { type: 'string' },
          unit_of_measure: { type: 'string' },
          reorder_level: { type: 'integer' },
          prescription_required: { type: 'boolean' },
          total_active_stock: { type: 'integer' },
          stock_status: { type: 'string', enum: ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'] },
        },
      },
      Batch: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          medicine_id: { type: 'integer' },
          batch_number: { type: 'string' },
          initial_quantity: { type: 'integer' },
          quantity: { type: 'integer' },
          cost_price: { type: 'number' },
          sale_price: { type: 'number' },
          manufacturing_date: { type: 'string', format: 'date' },
          expiry_date: { type: 'string', format: 'date' },
          status: { type: 'string', enum: ['ACTIVE', 'EXPIRED', 'DEPLETED', 'QUARANTINED'] },
          days_to_expiry: { type: 'integer' },
          expiry_urgency: { type: 'string', enum: ['SAFE', 'NEAR_EXPIRY', 'CRITICAL_EXPIRY', 'EXPIRED'] },
        },
      },
      SaleRequest: {
        type: 'object',
        required: ['items', 'amountPaid'],
        properties: {
          customerName: { type: 'string', default: 'Walk-in Customer' },
          customerPhone: { type: 'string' },
          doctorName: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['medicineId', 'quantity'],
              properties: {
                medicineId: { type: 'integer' },
                batchId: { type: 'integer', description: 'Optional: if omitted, FEFO assigns earliest expiring batch' },
                quantity: { type: 'integer', minimum: 1 },
                unitPrice: { type: 'number' },
              },
            },
          },
          discount: { type: 'number', default: 0 },
          paymentMethod: { type: 'string', enum: ['CASH', 'CARD', 'UPI', 'INSURANCE'], default: 'CASH' },
          amountPaid: { type: 'number' },
          notes: { type: 'string' },
        },
      },
      AdjustmentRequest: {
        type: 'object',
        required: ['type', 'batchId', 'quantity', 'reason'],
        properties: {
          type: {
            type: 'string',
            enum: ['CUSTOMER_RETURN', 'SUPPLIER_RETURN', 'EXPIRED_DISPOSAL', 'DAMAGED_WRITE_OFF', 'PHYSICAL_AUDIT_CORRECTION'],
          },
          batchId: { type: 'integer' },
          quantity: { type: 'integer', description: 'Negative for reductions; positive for additions' },
          reason: { type: 'string', minLength: 3, description: 'Mandatory operational reason' },
          relatedSaleId: { type: 'integer' },
        },
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
  paths: {
    '/auth/login': {
      post: {
        summary: 'Authenticate user & receive JWT token',
        tags: ['Authentication'],
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                  username: { type: 'string', example: 'admin' },
                  password: { type: 'string', example: 'admin123' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Authentication successful with token & user info' },
          401: { description: 'Invalid username or password' },
        },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Get current user profile',
        tags: ['Authentication'],
        responses: { 200: { description: 'User profile retrieved' } },
      },
    },
    '/medicines': {
      get: {
        summary: 'List medicines with stock and search',
        tags: ['Catalogue'],
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'categoryId', in: 'query', schema: { type: 'integer' } },
          { name: 'lowStock', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: { 200: { description: 'List of medicines' } },
      },
      post: {
        summary: 'Create new medicine (ADMIN, PHARMACIST)',
        tags: ['Catalogue'],
        responses: { 201: { description: 'Medicine created' } },
      },
    },
    '/medicines/{id}/fefo': {
      get: {
        summary: 'Preview FEFO batch allocation for requested quantity',
        tags: ['Inventory & FEFO'],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'quantity', in: 'query', required: true, schema: { type: 'integer' } },
        ],
        responses: { 200: { description: 'FEFO batch allocation plan' } },
      },
    },
    '/batches': {
      get: {
        summary: 'List inventory batches with expiry tracking',
        tags: ['Inventory & FEFO'],
        responses: { 200: { description: 'List of batches' } },
      },
    },
    '/batches/{id}/status': {
      patch: {
        summary: 'Quarantine or change batch status (ADMIN, PHARMACIST)',
        tags: ['Inventory & FEFO'],
        responses: { 200: { description: 'Status updated' } },
      },
    },
    '/sales': {
      get: {
        summary: 'List sales invoices',
        tags: ['Sales & POS'],
        responses: { 200: { description: 'Sales list' } },
      },
      post: {
        summary: 'Point of sale checkout with FEFO stock deduction (ACID Transaction)',
        tags: ['Sales & POS'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SaleRequest' } } },
        },
        responses: {
          201: { description: 'Sale completed & invoice created' },
          422: { description: 'Expired batch blocked or insufficient stock' },
        },
      },
    },
    '/adjustments': {
      get: {
        summary: 'List stock adjustments and returns (ADMIN, PHARMACIST)',
        tags: ['Adjustments & Returns'],
        responses: { 200: { description: 'Adjustments list' } },
      },
      post: {
        summary: 'Record stock return or adjustment with mandatory reason (ADMIN, PHARMACIST)',
        tags: ['Adjustments & Returns'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AdjustmentRequest' } } },
        },
        responses: {
          201: { description: 'Adjustment processed' },
          422: { description: 'Negative stock prevented or insufficient batch quantity' },
        },
      },
    },
    '/reports/dashboard': {
      get: {
        summary: 'Get dashboard KPIs and operational alerts',
        tags: ['Reports & Analytics'],
        responses: { 200: { description: 'Dashboard stats' } },
      },
    },
    '/reports/reconciliation': {
      get: {
        summary: 'Stock reconciliation audit (Opening + Inward - Sales +/- Adjustments = Closing)',
        tags: ['Reports & Analytics'],
        responses: { 200: { description: 'Reconciliation report' } },
      },
    },
    '/audit-logs': {
      get: {
        summary: 'View immutable system audit logs (ADMIN only)',
        tags: ['Audit Trail'],
        responses: { 200: { description: 'Audit logs' } },
      },
    },
  },
};

function setupSwagger(app) {
  app.get('/api/docs/json', (req, res) => {
    res.json(swaggerDocument);
  });

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    customSiteTitle: 'Pharmacy Management API Docs',
    customCss: '.swagger-ui .topbar { display: none }',
  }));
}

module.exports = { setupSwagger, swaggerDocument };

