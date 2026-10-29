import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import inventoryRoutes from './routes/inventory.routes';
import customerRoutes from './routes/customer.routes';
import costSheetRoutes from './routes/costSheet.routes';
import quotationRoutes from './routes/quotation.routes';
import bookingRoutes from './routes/booking.routes';
import paymentRoutes from './routes/payment.routes';
import dashboardRoutes from './routes/dashboard.routes';
import { errorHandler, globalLimiter } from './middlewares';

export const app = express();
const PORT = process.env.PORT || 5000;

// ==============================================================================
// 1. SECURITY HEADERS (Helmet: HSTS, Anti-Clickjacking, Anti-MIME Sniffing)
// ==============================================================================
app.use(
  helmet({
    // Prevents Clickjacking / UI Redressing by setting X-Frame-Options: SAMEORIGIN
    frameguard: { action: 'sameorigin' },
    // Prevents MIME type sniffing
    noSniff: true,
    // Adds Strict-Transport-Security for HTTPS
    hsts: { maxAge: 31536000, includeSubDomains: true },
    // Hides Express server technology
    hidePoweredBy: true,
    // Cross-origin resource policy
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Explicitly remove X-Powered-By header
app.disable('x-powered-by');

// ==============================================================================
// 2. CORS POLICY CONFIGURATION
// ==============================================================================
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server) or matching allowed list
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS policy: Origin not allowed'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400, // Preflight cache for 24 hours
  })
);

// ==============================================================================
// 3. RATE LIMITING (DDoS & Brute-Force Protection)
// ==============================================================================
app.use('/api', globalLimiter);

// JSON Body Parser with strict 1MB payload limit (Prevents payload-bloat DoS)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ==============================================================================
// 4. API ROUTES
// ==============================================================================

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'Rohan Core Lite API',
    security: {
      headers: 'helmet-active',
      cors: 'configured',
      rateLimiter: 'active',
    },
  });
});

// Mount Resource Routes
app.use('/api/units', inventoryRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/cost-sheets', costSheetRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Global Error Handler
app.use(errorHandler);

// Start Server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🛡️ Rohan Core Lite Backend Server (Hardened & Secured)`);
    console.log(`🚀 Port: ${PORT}`);
    console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`=======================================================`);
  });
}

export default app;

