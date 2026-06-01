/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set standard limits for larger payloads
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ limit: "15mb", extended: true }));

  // API REST Proxy router to bypass browser CORS constraints
  app.post("/api/proxy", async (req: express.Request, res: express.Response) => {
    const { url, method, headers, body } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 seconds timeout

      const headersObj = new Headers();
      if (headers && typeof headers === "object") {
        Object.entries(headers).forEach(([k, v]) => {
          const lowerKey = k.toLowerCase();
          // Filter forbidden or automated Node-specific headers that might interfere
          if (lowerKey !== "host" && lowerKey !== "content-length") {
            headersObj.set(k, v as string);
          }
        });
      }

      const fetchConfig: RequestInit = {
        method: method || "GET",
        headers: headersObj,
        signal: controller.signal,
      };

      // Set body for modifying verbs
      if (
        method &&
        ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase()) &&
        body !== undefined &&
        body !== null
      ) {
        // If it looks like form data, parse or keep it
        fetchConfig.body = typeof body === "object" ? JSON.stringify(body) : body;
      }

      const response = await fetch(url, fetchConfig);
      clearTimeout(timeoutId);

      const latency = Date.now() - startTime;

      const resHeaders: Record<string, string> = {};
      response.headers.forEach((val, key) => {
        resHeaders[key] = val;
      });

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const size = buffer.length;

      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      let bodyText = "";

      const isBinary =
        contentType.includes("image/") ||
        contentType.includes("audio/") ||
        contentType.includes("video/") ||
        contentType.includes("application/octet-stream") ||
        contentType.includes("zip") ||
        contentType.includes("pdf") ||
        contentType.includes("epub") ||
        contentType.includes("tar") ||
        contentType.includes("gzip");

      if (isBinary) {
        bodyText = `[Binary Data] Content-Type: ${contentType}\nSize: ${size} bytes\nBase64 Preview:\n` + buffer.toString("base64");
      } else {
        bodyText = buffer.toString("utf-8");
      }

      res.json({
        status: response.status,
        statusText: response.statusText || "OK",
        headers: resHeaders,
        body: bodyText,
        time: latency,
        size,
      });
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      res.json({
        status: 0,
        statusText: "Error",
        headers: {},
        body: `Proxy Error: ${error.message}. This could be due to a malformed URL, DNS issue, self-signed certificate, or request timeout.`,
        time: elapsed,
        size: 0,
        error: error.message,
      });
    }
  });

  // Hot Reload and Asset integration with Vite
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server fully started on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical: Express failed to start:", err);
});
