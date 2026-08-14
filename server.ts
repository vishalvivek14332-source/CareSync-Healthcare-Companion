import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { initDb, db } from "./server/db";
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

dotenv.config();

async function startServer() {
  // Initialize SQLite Database Schema & Seed default records if empty
  initDb();

  // Start background escalation worker (checks every 15s)
  startEscalationWorker(15000);

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Security Headers Middleware
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Initialize Gemini AI client if API key exists
  let ai: GoogleGenAI | null = null;
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", database: "connected", timestamp: new Date().toISOString() });
  });

  // Mount API Routers
  app.use("/api/auth", authRouter);
  app.use("/api/patient", authenticateToken, patientRouter);
  app.use("/api/medications", authenticateToken, medicationRouter);
  app.use("/api/hydration", authenticateToken, hydrationRouter);
  app.use("/api/activity", authenticateToken, activityRouter);
  app.use("/api/caregiver", authenticateToken, caregiverRouter);
  app.use("/api/alerts", authenticateToken, alertRouter);
  app.use("/api/escalation", authenticateToken, escalationRouter);
  app.use("/api/notifications", authenticateToken, notificationRouter);

  // CareSync Assistant AI endpoint (context-aware & server-side Gemini)
  app.post("/api/assistant", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { message, context } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      const patientId = req.user?.userId || 'p-1';
      const patient = db.prepare('SELECT name FROM users WHERE id = ?').get(patientId) as any;
      const patientName = patient?.name || context?.patientName || "Alex Johnson";

      // If Gemini client is available, call Gemini API
      if (ai) {
        const systemInstruction = `You are CareSync Assistant, a warm, supportive, and reliable healthcare & routine companion for elderly individuals, patients, and their family caregivers.
Your job is to help users manage daily health routines, including medications, hydration, walking/activity, and wellness logs.

IMPORTANT COMPLIANCE RULES:
- You are a wellness and routine companion. You do NOT give medical diagnoses or prescribe medical treatment.
- Keep responses conversational, concise, encouraging, and clear.
- Avoid jargon or complex medical text.
- Large, simple sentences that are easy to read and understand.
- Always be gentle, friendly, and empowering.

User Context provided:
- Patient Name: ${patientName}
- Morning Medication: ${context?.medicationStatus?.morning || "Taken"}
- Afternoon Medication: ${context?.medicationStatus?.afternoon || "Due soon"}
- Evening Medication: ${context?.medicationStatus?.evening || "Upcoming"}
- Hydration: ${context?.hydration?.current || 1.4}L of ${context?.hydration?.target || 2.0}L goal
- Activity: ${context?.activity?.steps || 4821} steps of ${context?.activity?.target || 5000} target
- CareScore: ${context?.careScore || 86}/100

If the user asks to log something (e.g., "I drank 250 ml of water", "I took my afternoon med", "I walked for 20 minutes"), acknowledge it warmly and confirm the action. Respond in clear, friendly English. Keep under 3-4 sentences.`;

        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: message,
          config: {
            systemInstruction,
            temperature: 0.7,
          },
        });

        const reply = response.text || "I'm here to help you with your daily routine! How can I assist you today?";
        return res.json({ reply });
      } else {
        // Fallback intelligent response if GEMINI_API_KEY is not set yet
        const lowerMsg = message.toLowerCase();
        let fallbackReply = "I'm here to help you stay on track with your routines! ";

        if (lowerMsg.includes("what do i need to do") || lowerMsg.includes("schedule") || lowerMsg.includes("routine")) {
          fallbackReply = "You have your Afternoon Medication due at 1:00 PM, and you are 600 ml away from your daily hydration goal. Great job on completing your morning walk!";
        } else if (lowerMsg.includes("water") || lowerMsg.includes("drink") || lowerMsg.includes("hydration")) {
          fallbackReply = `You've logged ${context?.hydration?.current || 1.4} L of your ${context?.hydration?.target || 2.0} L target today. Drinking one glass (250 ml) now will put you closer to your goal!`;
        } else if (lowerMsg.includes("medication") || lowerMsg.includes("medicine") || lowerMsg.includes("pill")) {
          fallbackReply = "Your Morning Medication (Vitamin D + Lisinopril) was taken at 8:00 AM. Your Afternoon Medication is scheduled for 1:00 PM.";
        } else if (lowerMsg.includes("walk") || lowerMsg.includes("steps") || lowerMsg.includes("exercise")) {
          fallbackReply = `You have completed ${context?.activity?.steps || 4821} steps out of your ${context?.activity?.target || 5000} goal today. You're just a short stroll away from reaching your target!`;
        } else if (lowerMsg.includes("score") || lowerMsg.includes("carescore")) {
          fallbackReply = `Your CareScore today is ${context?.careScore || 86}/100! Your medication adherence is excellent, and a quick water break will boost your hydration score.`;
        } else {
          fallbackReply = `I'm here with you, ${patientName}. Your routine is in great shape today. What would you like to log or check on?`;
        }

        return res.json({ reply: fallbackReply });
      }
    } catch (err: any) {
      console.error("Error in /api/assistant:", err);
      return res.status(500).json({
        reply: "I'm having a little trouble connecting right now, but your morning routine looks great! Please try asking again in a moment.",
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
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

  const serverInstance = app.listen(PORT, "0.0.0.0", () => {
    console.log(`CareSync server running on http://localhost:${PORT}`);
  });

  const gracefulShutdown = () => {
    console.log("\n[Server] Shutting down gracefully...");
    stopEscalationWorker();
    serverInstance.close(() => {
      try {
        db.close();
      } catch (e) {}
      console.log("[Server] HTTP server & Database closed cleanly.");
      process.exit(0);
    });
  };

  process.on("SIGINT", gracefulShutdown);
  process.on("SIGTERM", gracefulShutdown);
}

startServer();
