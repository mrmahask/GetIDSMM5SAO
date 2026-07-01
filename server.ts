import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Helper to clean and fetch Facebook pages
async function fetchFbPage(urlOrUsername: string): Promise<string> {
  let url = urlOrUsername.trim();
  
  // If only a username is provided
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://www.facebook.com/${url}`;
  }

  // Ensure it's a mobile or standard www URL
  // We can try fetching the mobile or basic version if needed, but www contains modern meta tags
  console.log(`[Backend Resolver] Fetching Facebook URL: ${url}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1"
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`Facebook server responded with status: ${response.status}`);
    }
    
    return await response.text();
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error(`[Backend Resolver] Error fetching URL: ${err.message}`);
    throw err;
  }
}

// Extract ID using refined Regexes
function extractIdUsingRegex(html: string): { id: string; type: string } | null {
  const regexes = [
    // 1. Meta property tags
    { regex: /property="al:ios:url"\s+content="fb:\/\/profile\/(\d+)"/i, type: "Profile" },
    { regex: /property="al:android:url"\s+content="fb:\/\/profile\/(\d+)"/i, type: "Profile" },
    { regex: /property="al:ios:url"\s+content="fb:\/\/page\/(\d+)"/i, type: "Page" },
    { regex: /property="al:android:url"\s+content="fb:\/\/page\/(\d+)"/i, type: "Page" },
    { regex: /property="al:ios:url"\s+content="fb:\/\/group\/(\d+)"/i, type: "Group" },
    { regex: /property="al:android:url"\s+content="fb:\/\/group\/(\d+)"/i, type: "Group" },
    
    // 2. Direct JSON/script definitions
    { regex: /"userID"\s*:\s*"(\d+)"/i, type: "Profile" },
    { regex: /"profile_owner"\s*:\s*"(\d+)"/i, type: "Profile" },
    { regex: /"entity_id"\s*:\s*"(\d+)"/i, type: "Entity (Page/Group/Profile)" },
    { regex: /"pageID"\s*:\s*"(\d+)"/i, type: "Page" },
    { regex: /"delegatePage"\s*:\s*\{\s*"id"\s*:\s*"(\d+)"/i, type: "Page" },
    
    // 3. Raw deep link references
    { regex: /fb:\/\/profile\/(\d+)/i, type: "Profile" },
    { regex: /fb:\/\/page\/(\d+)/i, type: "Page" },
    { regex: /fb:\/\/group\/(\d+)/i, type: "Group" },
    { regex: /fb:\/\/group\/\?id=(\d+)/i, type: "Group" },
    { regex: /fb:\/\/event\/(\d+)/i, type: "Event" },
    
    // 4. Android package deep links
    { regex: /android-app:\/\/com\.facebook\.katana\/fb\/profile\/(\d+)/i, type: "Profile" },
    { regex: /android-app:\/\/com\.facebook\.katana\/fb\/page\/(\d+)/i, type: "Page" }
  ];

  for (const item of regexes) {
    const match = html.match(item.regex);
    if (match && match[1]) {
      console.log(`[Backend Resolver] Match found using regex for ${item.type}: ${match[1]}`);
      return { id: match[1], type: item.type };
    }
  }

  return null;
}

// Fallback to Gemini API to read HTML context and extract the ID
async function extractIdUsingGemini(html: string): Promise<{ id: string; type: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    console.log("[Backend Resolver] Gemini API Key is not set or placeholder. Skipping AI fallback.");
    return null;
  }

  console.log("[Backend Resolver] Running Gemini AI extraction on page HTML segments...");

  // Extract critical parts of HTML to avoid token limits (first 120KB often has all head tags and top scripts)
  const truncatedHtml = html.slice(0, 150000);

  try {
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const prompt = `
Task: Analyze the provided Facebook page raw HTML source code and extract the numerical Facebook ID.
Facebook IDs are pure numbers, typically 4 to 16 digits long. Common types:
- User Profile ID (e.g. 4, 100088899123456)
- Page ID (e.g. 20531316728)
- Group ID
- Event ID

Look carefully at meta tags (al:android:url, al:ios:url), script tags, userID fields, entity_id fields, delegatePage, and any other JSON blobs.

Instructions:
1. If you find a valid Facebook numeric ID, respond ONLY with a JSON object in this format (no markdown code blocks, no text around it):
{"id": "THE_NUMERIC_ID", "type": "Profile|Page|Group|Event"}

2. If you absolutely cannot find any numeric ID, respond ONLY with:
{"error": "NOT_FOUND"}

Here is the HTML content:
---
${truncatedHtml}
---
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt
    });

    const responseText = response.text?.trim() || "";
    console.log(`[Backend Resolver] Gemini response: ${responseText}`);
    
    // Parse response
    const cleanedJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(cleanedJson);
    
    if (result && result.id) {
      return { id: result.id, type: result.type || "Decoded Profile" };
    }
  } catch (error: any) {
    console.error(`[Backend Resolver] Gemini extraction failed: ${error.message}`);
  }

  return null;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API resolver endpoint
  app.post("/api/resolve-id", async (req, res) => {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: "URL or username is required." });
    }

    try {
      const html = await fetchFbPage(url);
      
      // Step 1: Fast Regex Matching
      let match = extractIdUsingRegex(html);
      
      // Step 2: AI Fallback
      if (!match) {
        match = await extractIdUsingGemini(html);
      }

      if (match) {
        return res.json({
          success: true,
          id: match.id,
          type: match.type,
          originalUrl: url
        });
      }

      return res.status(404).json({
        error: "Could not locate a numeric ID in the profile's page source. This account may be fully private, or restricted."
      });
    } catch (err: any) {
      console.error(`[API /api/resolve-id] Error: ${err.message}`);
      return res.status(500).json({
        error: `Could not load page source: ${err.message}. Please check if the URL is valid and accessible.`
      });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
