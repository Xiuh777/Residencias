import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ajusta la ruta del .env según donde lo tengas guardado
dotenv.config({ path: path.join(__dirname, "../.env") });

const app = express();
app.use(express.json({ limit: '10mb' })); 
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));

const PORT = process.env.PORT || 5000;

// Configuración de la IA
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_NAME = "gemini-2.5-flash"; 

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// 1. Obtener Token de Spotify
app.get("/api/token", async (req, res) => {
  try {
    const auth = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({ grant_type: "client_credentials" }).toString(),
      { headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" } }
    );
    res.json({ token: response.data.access_token });
  } catch (error) { 
    console.error("Error Token:", error.message);
    res.status(500).json({ error: error.message }); 
  }
});

// 2. Recomendación IA (Actualizado para Smart Mix)
app.post("/api/ai-recommendation", async (req, res) => {
  const { userPrompt } = req.body;
  
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME, safetySettings }); 

    // Prompt mejorado para separar géneros (queries)
    const prompt = `
      Eres un experto musical. El usuario busca: "${userPrompt}".
      
      TAREA:
      1. Si el usuario pide varios géneros o artistas (ej: "Rock y Reggaeton"), sepáralos.
      2. Si usa jerga (ej: "bellakeo"), tradúcelo a "Reggaeton Old School".
      3. Si es una actividad (ej: "jugar minecraft"), busca "C418" o "Ambient".
      
      Responde SOLO este JSON (sin markdown): 
      {
        "queries": ["Busqueda 1", "Busqueda 2", "Busqueda 3"], 
        "hexColor": "#COLOR_HEX_VIBRANTE",
        "aiMessage": "Breve mensaje del DJ"
      }
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(text);
    
    console.log(`✅ IA Mix: ${JSON.stringify(data.queries)}`);
    res.json(data);

  } catch (error) {
    console.error("❌ Error IA (Fallback):", error.message);
    
    // Fallback compatible con el nuevo frontend
    let cleanTerm = userPrompt;
    if (userPrompt.toLowerCase().includes("minecraft")) cleanTerm = "Minecraft Soundtrack";
    
    res.json({ queries: [cleanTerm], hexColor: "#1db954", aiMessage: "Buscando..." }); 
  }
});

// 3. Visión IA (Actualizado para devolver queries)
app.post("/api/ai-vision", async (req, res) => {
  const { imageBase64 } = req.body;
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME, safetySettings });
    const prompt = `Analiza la imagen. Responde SOLO JSON: {"queries": ["Género 1", "Género 2"], "hexColor": "#COLOR", "aiMessage": "Vibe detectada"}`;
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