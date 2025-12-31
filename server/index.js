import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const app = express();
app.use(express.json({ limit: '10mb' })); 
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));

const PORT = process.env.PORT || 5000;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_NAME = "gemini-2.5-flash"; 

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

app.get("/api/token", async (req, res) => {
  try {
    const auth = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({ grant_type: "client_credentials" }).toString(),
      { headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" } }
    );
    res.json({ token: response.data.access_token });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- LÓGICA DE MEZCLA INTELIGENTE ---
app.post("/api/ai-recommendation", async (req, res) => {
  const { userPrompt } = req.body;
  
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME, safetySettings }); 

    // Prompt actualizado para separar géneros
    const prompt = `
      Eres un DJ experto. El usuario quiere un mix: "${userPrompt}".
      
      TAREA:
      1. Identifica los diferentes géneros, artistas o moods.
      2. Sepáralos en una lista de términos de búsqueda para Spotify.
      3. Si usa jerga (ej: "bellakeo"), tradúcelo (ej: "Reggaeton Old School").
      
      Responde SOLO este JSON: 
      {
        "queries": ["Busqueda1", "Busqueda2", "Busqueda3"], 
        "hexColor": "#COLOR_HEX_VIBRANTE",
        "aiMessage": "Frase corta describiendo el mix"
      }
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(text);
    
    console.log(`✅ Mix Generado para "${userPrompt}":`, data.queries);
    res.json(data);

  } catch (error) {
    console.error("❌ Error IA (Fallback):", error.message);
    // Si falla, devolvemos la búsqueda original tal cual
    res.json({ queries: [userPrompt], hexColor: "#1db954", aiMessage: "Buscando tu música..." }); 
  }
});

app.post("/api/ai-vision", async (req, res) => {
  const { imageBase64 } = req.body;
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME, safetySettings });
    // También actualizamos la visión para devolver una lista
    const prompt = `Analiza la imagen. Responde SOLO JSON: {"queries": ["género1", "género2"], "hexColor": "#COLOR", "aiMessage": "Vibe detectada"}`;
    const imagePart = { inlineData: { data: imageBase64.split(",")[1], mimeType: "image/jpeg" } };
    const result = await model.generateContent([prompt, imagePart]);
    const text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    res.json(JSON.parse(text));
  } catch (error) { 
    console.error("Error Visión:", error.message);
    res.status(500).json({ error: "Error visión" }); 
  }
});

app.listen(PORT, () => console.log(`🚀 Servidor listo en puerto ${PORT}`));