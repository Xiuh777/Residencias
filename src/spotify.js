const getBackendUrl = () => {
  if (import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL;
  return "http://localhost:5000";
};
const BASE_URL = getBackendUrl();

// Función de mezcla (Solo la usaremos si es la primera página para variar un poco)
const shuffleArray = (array) => array.sort(() => Math.random() - 0.5);

export async function getAccessToken() {
  try {
    const res = await fetch(`${BASE_URL}/api/token`);
    if (!res.ok) throw new Error("Error token");
    const data = await res.json();
    return data.token;
  } catch (error) { return null; }
}

async function getAIRecommendation(userPrompt) {
    try {
        const res = await fetch(`${BASE_URL}/api/ai-recommendation`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userPrompt })
        });
        return await res.json();
    } catch (error) { return { searchTerms: userPrompt, hexColor: "#1db954" }; }
}

export async function analyzeImageAndSearch(imageBase64) {
    try {
        const res = await fetch(`${BASE_URL}/api/ai-vision`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64 })
        });
        const data = await res.json();
        // Offset 0 para imagen nueva
        const searchRes = await searchPlaylistsByMood(data.searchTerms, 0, true);
        return { ...searchRes, aiInterpretation: data.moodDescription, moodColor: data.hexColor };
    } catch (error) { return null; }
}

// --- FUNCIÓN CENTRAL ACTUALIZADA ---
// Ahora acepta 'offset' y eliminamos el randomOffset para que 'Cargar más' traiga cosas nuevas
async function fetchSpotify(token, query, type = 'playlist', limit = 20, offset = 0) {
    const url = `https://api.spotify.com/v1/search?q=$/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}&offset=${offset}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return [];
    const data = await res.json();
    
    if (type === 'playlist') return data.playlists?.items.filter(item => item !== null) || [];
    return data.tracks?.items.filter(item => item !== null) || [];
}

// MOOD (Con Paginación)
// Orden de args cambiado para coincidir con React: (query, offset, skipAI)
export async function searchPlaylistsByMood(query, offset = 0, skipAI = false) {
  const token = await getAccessToken();
  if (!token) throw new Error("No token");

  try {
    let searchTerms = query;
    let hexColor = "#1db954";

    // Solo consultamos a la IA en la primera página (offset 0) y si no se salta
    if (!skipAI && offset === 0) {
        const aiData = await getAIRecommendation(query);
        searchTerms = aiData.searchTerms || query;
        hexColor = aiData.hexColor || "#1db954";
    }
    
    // Pasamos el offset a la función fetch
    let items = await fetchSpotify(token, searchTerms, 'playlist', 20, offset);

    // Fallback si la IA falló, solo en primera página
    if (items.length === 0 && searchTerms !== query && offset === 0) {
        items = await fetchSpotify(token, query, 'playlist', 20, 0);
    }

    // Solo mezclamos si es la primera página, para paginación necesitamos orden estable
    if (offset === 0) items = shuffleArray(items);

    return { items: items, aiTerms: searchTerms, moodColor: hexColor };
  } catch (error) { return { items: [], aiTerms: query, moodColor: "#1db954" }; }
}

// ARTISTA (Híbrido: Top Tracks + Busqueda paginada)
export async function searchArtistsAndTracks(query, offset = 0) {
  const token = await getAccessToken();
  if (!token) throw new Error("No token");
  try {
    // 1. Si es "Cargar más" (offset > 0), buscamos canciones del artista directamente
    // porque el endpoint "Top Tracks" NO tiene paginación.
    if (offset > 0) {
         // Buscamos tracks donde el artista sea 'query'
         const moreTracks = await fetchSpotify(token, `artist:${query}`, 'track', 20, offset);
         return { artistName: query, tracks: moreTracks };
    }

    // 2. Si es la primera búsqueda (offset 0), hacemos la lógica bonita de Artist + Top Tracks
    const artistRes = await fetch(`https://api.spotify.com/v1/search?q=$/search?q=${encodeURIComponent(query)}&type=artist&limit=1`, { headers: { Authorization: `Bearer ${token}` } });
    const artistData = await artistRes.json();
    const artistItem = artistData.artists?.items?.[0];
    
    if (!artistItem) return { artistName: query, tracks: [] };

    const tracksRes = await fetch(`https://api.spotify.com/v1/search?q=$/artists/${artistItem.id}/top-tracks?market=US`, { headers: { Authorization: `Bearer ${token}` } });
    const tracksData = await tracksRes.json();

    return { artistName: artistItem.name, tracks: tracksData.tracks || [] };
  } catch (error) { return { artistName: query, tracks: [] }; }
}

// CANCIONES (Con Paginación)
export async function searchTracks(query, offset = 0) {
  const token = await getAccessToken();
  if (!token) throw new Error("No token");
  try {
    // Pasamos offset
    const tracks = await fetchSpotify(token, query, 'track', 20, offset);
    
    const formattedTracks = tracks.map(t => ({
        id: t.id, name: t.name, artist: t.artists[0].name,
        albumImage: t.album.images[0]?.url || t.album.images[1]?.url,
        previewUrl: t.preview_url,
        externalUrl: t.external_urls?.spotify,
        type: 'track'
    }));

    return { tracks: formattedTracks }; 
  } catch (error) { return { tracks: [] }; }
}

export async function searchGlobalTop(countryCode, offset = 0) {
    // Pasamos offset y skipAI=true
    return searchPlaylistsByMood(`Top 50 ${countryCode}`, offset, true);
}