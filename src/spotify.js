const getBackendUrl = () => {
  if (import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL;
  return "http://localhost:5000";
};
const BASE_URL = getBackendUrl();

// Función de mezcla
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
        const searchRes = await searchPlaylistsByMood(data.searchTerms, 0, true);
        return { ...searchRes, aiInterpretation: data.moodDescription, moodColor: data.hexColor };
    } catch (error) { return null; }
}

// --- CORRECCIÓN PRINCIPAL AQUÍ (Faltaban los $) ---
async function fetchSpotify(token, query, type = 'playlist', limit = 20, offset = 0) {
    // CORREGIDO: ${encodeURIComponent(query)} en lugar de {encodeURIComponent(query)}
    // CORREGIDO: URL oficial de Spotify https://api.spotify.com/v1/search
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}&offset=${offset}`;
    
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return [];
    const data = await res.json();
    
    if (type === 'playlist') return data.playlists?.items.filter(item => item !== null) || [];
    return data.tracks?.items.filter(item => item !== null) || [];
}

// MOOD
export async function searchPlaylistsByMood(query, offset = 0, skipAI = false) {
  const token = await getAccessToken();
  if (!token) throw new Error("No token");

  try {
    let searchTerms = query;
    let hexColor = "#1db954";

    if (!skipAI && offset === 0) {
        const aiData = await getAIRecommendation(query);
        searchTerms = aiData.searchTerms || query;
        hexColor = aiData.hexColor || "#1db954";
    }
    
    let items = await fetchSpotify(token, searchTerms, 'playlist', 20, offset);

    if (items.length === 0 && searchTerms !== query && offset === 0) {
        items = await fetchSpotify(token, query, 'playlist', 20, 0);
    }

    if (offset === 0) items = shuffleArray(items);

    return { items: items, aiTerms: searchTerms, moodColor: hexColor };
  } catch (error) { return { items: [], aiTerms: query, moodColor: "#1db954" }; }
}

// --- AQUÍ ESTABA EL ERROR DEL CANTANTE ---
export async function searchArtistsAndTracks(query, offset = 0) {
  const token = await getAccessToken();
  if (!token) throw new Error("No token");
  try {
    // 1. Paginación: Si es cargar más, buscamos canciones del artista
    if (offset > 0) {
         // CORREGIDO: Añadido el $ antes de {query}
         const moreTracks = await fetchSpotify(token, `artist:${query}`, 'track', 20, offset);
         return { artistName: query, tracks: moreTracks };
    }

    // 2. Primera búsqueda: Buscar ID del artista
    // CORREGIDO: Añadido el $ y URL oficial
    const artistRes = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist&limit=1`, { 
        headers: { Authorization: `Bearer ${token}` } 
    });
    
    const artistData = await artistRes.json();
    const artistItem = artistData.artists?.items?.[0];
    
    if (!artistItem) return { artistName: query, tracks: [] };

    // 3. Obtener Top Tracks del artista
    // CORREGIDO: Añadido el $ antes de {artistItem.id}
    const tracksRes = await fetch(`https://api.spotify.com/v1/artists/${artistItem.id}/top-tracks?market=US`, { 
        headers: { Authorization: `Bearer ${token}` } 
    });
    const tracksData = await tracksRes.json();

    return { artistName: artistItem.name, tracks: tracksData.tracks || [] };
  } catch (error) { 
      console.error(error);
      return { artistName: query, tracks: [] }; 
  }
}

// CANCIONES
export async function searchTracks(query, offset = 0) {
  const token = await getAccessToken();
  if (!token) throw new Error("No token");
  try {
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
    return searchPlaylistsByMood(`Top 50 ${countryCode}`, offset, true);
}