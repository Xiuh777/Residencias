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

app.post("/api/ai-recommendation", async (req, res) => {
  const { userPrompt } = req.body;
  
  try {
    // Usamos la constante MODEL_NAME para asegurar que sea la 2.5 esto para la IA
    const model = genAI.getGenerativeModel({ model: MODEL_NAME, safetySettings }); 

    const prompt = `
      Eres un experto musical. El usuario busca: "${userPrompt}".
      IMPORTANTE:
      - Si es jerga (ej: bellakeo, perreo), asócialo a Reggaeton, Urbano, Dembow.
      - Si es actividad (ej: minar minecraft), asócialo a Ambient, C418, Synthwave.
      
      Responde SOLO este JSON (sin markdown): 
      {"searchTerms": "3 géneros o artistas en INGLÉS separados por comas", "hexColor": "#COLOR_HEX_VIBRANTE"}
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(text);
    
    console.log(`✅ IA Conectada (${MODEL_NAME}): ${data.searchTerms}`);
    res.json(data);

  } catch (error) {
    console.error("❌ Error IA (Usando Fallback):", error.message);
    
    // Fallback por si acaso
    let cleanTerm = userPrompt;
    if (userPrompt.toLowerCase().includes("minecraft")) cleanTerm = "Minecraft Soundtrack";
    if (userPrompt.toLowerCase().includes("bellakeo")) cleanTerm = "Reggaeton Old School";
    
    res.json({ searchTerms: cleanTerm, hexColor: "#1db954" }); 
  }
});

app.post("/api/ai-vision", async (req, res) => {
  const { imageBase64 } = req.body;
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME, safetySettings });
    const prompt = `Analiza la imagen. Responde SOLO JSON: {"moodDescription": "Descripción", "searchTerms": "3 géneros", "hexColor": "#COLOR"}`;
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