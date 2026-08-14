import express, { Request, Response, NextFunction } from "express";
import path from "path";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { v4 as uuidv4 } from "uuid";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { config } from "./server/config";
import { initDb, db, checkDatabaseHealth, pgPool } from "./server/db";
import { authenticateToken, AuthenticatedRequest } from "./server/auth";
import { authRouter } from "./server/routes/authRoutes";
import { patientRouter } from "./server/routes/patientRoutes";
import { medicationRouter } from "./server/routes/medicationRoutes";
import { hydrationRouter } from "./server/routes/hydrationRoutes";
import { activityRouter } from "./server/routes/activityRoutes";
import { caregiverRouter } from "./server/routes/caregiverRoutes";
import { alertRouter } from "./server/routes/alertRoutes";
import { escalationRouter } from "./server/routes/escalationRoutes";
import { notificationRouter } from "./server/routes/notificationRoutes";
import { startEscalationWorker, stopEscalationWorker } from "./server/services/escalationWorker";

async function startServer() {
  // 1. Initialize Database (PostgreSQL in production, SQLite in local dev/test)
  await initDb();

  // 2. Start background escalation worker (checks every 15s)
  startEscalationWorker(15000);

  const app = express();

  // 3. Security Headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: false, // Vite handles CSP in dev
      crossOriginEmbedderPolicy: false,
    })
  );

  // 4. Strict CORS Configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile native apps, curl, server-to-server)
        if (!origin) return callback(null, true);

        const allowedOrigins = [
          ...config.corsAllowedOrigins,
          "capacitor://localhost",
          "http://localhost",
        ];

        // In non-production, also allow dev loops on localhost
        if (!config.isProduction) {
          if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
            return callback(null, true);
          }
        }

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error(`Origin ${origin} not permitted by CORS policy`));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID", "X-Requested-With"],
    })
  );

  // 5. Request ID & Structured Request Logging Middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = (req.headers["x-request-id"] as string) || uuidv4();
    res.setHeader("X-Request-ID", requestId);
    const start = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - start;
      const statusCode = res.statusCode;
      if (req.path !== "/api/health" && req.path !== "/api/health/ready") {
        console.log(`[${new Date().toISOString()}] [${requestId.substring(0, 8)}] ${req.method} ${req.originalUrl} -> ${statusCode} (${duration}ms)`);
      }
    });

    next();
  });

  // 6. JSON Parser with payload limits
  app.use(express.json({ limit: "5mb" }));

  // 7. Rate Limiting for Auth Endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Max 100 requests per IP per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many authentication attempts. Please try again later." },
  });
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/signup", authLimiter);

  // 8. Health & Readiness Endpoints
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
    });
  });

  app.get("/api/health/ready", async (_req, res) => {
    const dbHealth = await checkDatabaseHealth();
    if (!dbHealth.ok) {
      return res.status(503).json({
        status: "not_ready",
        database: {
          ok: false,
          type: dbHealth.type,
        },
        timestamp: new Date().toISOString(),
      });
    }
    return res.json({
      status: "ready",
      database: {
        ok: true,
        type: dbHealth.type,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // 9. Initialize Gemini AI client if API key exists
  let ai: GoogleGenAI | null = null;
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }

  // 10. Mount API Routers
  app.use("/api/auth", authRouter);
  app.use("/api/patient", authenticateToken, patientRouter);
  app.use("/api/medications", authenticateToken, medicationRouter);
  app.use("/api/hydration", authenticateToken, hydrationRouter);
  app.use("/api/activity", authenticateToken, activityRouter);
  app.use("/api/caregiver", authenticateToken, caregiverRouter);
  app.use("/api/alerts", authenticateToken, alertRouter);
  app.use("/api/escalation", authenticateToken, escalationRouter);
  app.use("/api/notifications", authenticateToken, notificationRouter);

  // 11. CareSync Assistant AI endpoint
  app.post("/api/assistant", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { message, context } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      const patientId = req.user?.userId || "p-1";
      const patient = db.prepare("SELECT name FROM users WHERE id = ?").get(patientId) as any;
      const patientName = patient?.name || context?.patientName || "Alex Johnson";

      if (ai) {
        const systemInstruction = `You are CareSync Assistant, a warm, supportive, and reliable healthcare & routine companion for elderly individuals, patients, and their family caregivers.
Your job is to help users manage daily health routines, including medications, hydration, walking/activity, and wellness logs.
- Never provide medical diagnosis or replace a doctor.
- Keep responses friendly, encouraging, large, and concise.`;

        const prompt = `System: ${systemInstruction}\nUser message: "${message}"\nPatient Name: ${patientName}`;
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });

        return res.json({ reply: response.text });
      } else {
        const lowerMsg = message.toLowerCase();
        let fallbackReply = `I'm here with you, ${patientName}. What would you like to log or check on?`;
        if (lowerMsg.includes("water") || lowerMsg.includes("drink")) {
          fallbackReply = `You have logged ${context?.hydration?.current || 0}L of water today towards your ${context?.hydration?.goal || 2}L goal!`;
        } else if (lowerMsg.includes("walk") || lowerMsg.includes("step")) {
          fallbackReply = `You have logged ${context?.activity?.steps || 0} steps today!`;
        }
        return res.json({ reply: fallbackReply });
      }
    } catch (err: any) {
      console.error("Error in /api/assistant:", err);
      return res.status(500).json({
        reply: "I'm having a little trouble connecting right now, but your routine is on track! Please try asking again in a moment.",
      });
    }
  });

  // 12. Catch unhandled /api/* routes with JSON 404 (prevent SPA HTML fallback on API endpoints)
  app.all("/api/*", (req: Request, res: Response) => {
    res.status(404).json({
      error: "API endpoint not found",
      method: req.method,
      path: req.path,
    });
  });

  // 13. Frontend Static Delivery or Vite Middleware
  if (config.nodeEnv !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // 14. Start HTTP Server
  const serverInstance = app.listen(config.port, "0.0.0.0", () => {
    console.log(`================================================================`);
    console.log(`🚀 CareSync Server Running`);
    console.log(`   - Environment:   ${config.nodeEnv}`);
    console.log(`   - Port:          ${config.port}`);
    console.log(`   - Database Type: ${pgPool ? "PostgreSQL (Pool Active)" : "SQLite (Dev/Test)"}`);
    console.log(`   - JWT Secrets:   ${config.jwtAccessSecret ? "Configured" : "Missing"}`);
    console.log(`   - Database URL:  ${config.databaseUrl ? "Configured" : "None"}`);
    console.log(`   - CORS Origins:  ${config.corsAllowedOrigins.join(", ")}`);
    console.log(`================================================================`);
  });

  // 14. Graceful Shutdown Handler
  const gracefulShutdown = () => {
    console.log("\n🛑 [Server] Received shutdown signal. Closing resources gracefully...");
    stopEscalationWorker();
    serverInstance.close(async () => {
      try {
        if (pgPool) {
          await pgPool.end();
          console.log("   - PostgreSQL connection pool closed.");
        }
        db.close();
        console.log("   - SQLite instance closed.");
      } catch (e) {}
      console.log("✅ CareSync server shut down cleanly.");
      process.exit(0);
    });
  };

  process.on("SIGINT", gracefulShutdown);
  process.on("SIGTERM", gracefulShutdown);
}

startServer().catch((err) => {
  console.error("❌ Fatal error starting CareSync server:", err);
  process.exit(1);
});
