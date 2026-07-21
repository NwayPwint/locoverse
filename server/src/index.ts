import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { env } from "./config/env";
import { initSocket } from "./config/socket";
import { query } from "./config/database";
import { aiLimiter, messageLimiter, postLimiter, uploadLimiter, generalLimiter } from "./middleware/rateLimit";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import connectionRoutes from "./routes/connections";
import messageRoutes from "./routes/messages";
import compositionRoutes from "./routes/compositions";
import sharedSongRoutes from "./routes/sharedSongs";
import postRoutes from "./routes/posts";
import notificationRoutes from "./routes/notifications";
import articleRoutes from "./routes/articles";
import embedRoutes from "./routes/embed";
import safetyRoutes from "./routes/safety";

const app = express();
const httpServer = createServer(app);

initSocket(httpServer);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many attempts. Try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/users", generalLimiter, userRoutes);
app.use("/api/connections", generalLimiter, connectionRoutes);
app.use("/api/messages", messageLimiter, messageRoutes);
app.use("/api/compositions", generalLimiter, compositionRoutes);
app.use("/api/compositions/suggest-chords", aiLimiter);
app.use("/api/compositions/generate-lyrics", aiLimiter);
app.use("/api/compositions/upload-audio", uploadLimiter);
app.use("/api/shared-songs", postLimiter, sharedSongRoutes);
app.use("/api/posts", postLimiter, postRoutes);
app.use("/api/notifications", generalLimiter, notificationRoutes);
app.use("/api/articles", postLimiter, articleRoutes);
app.use("/embed", embedRoutes);
app.use("/api/blocks", generalLimiter, safetyRoutes);

app.get("/api/skills", async (_req, res) => {
  try {
    const result = await query("SELECT * FROM skills ORDER BY name");
    res.json({ skills: result.rows });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/vibes", async (_req, res) => {
  try {
    const result = await query("SELECT * FROM vibes ORDER BY name");
    res.json({ vibes: result.rows });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

httpServer.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});

export default app;
