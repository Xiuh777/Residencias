const getBackendUrl = () => {
  if (import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL;
  return "http://localhost:5000";
};
const BASE_URL = getBackendUrl();

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
        const searchRes = await searchPlaylistsByMood(data.searchTerms, true);
        return { ...searchRes, aiInterpretation: data.moodDescription, moodColor: data.hexColor };
    } catch (error) { return null; }
}

async function fetchSpotify(token, query, type = 'playlist', limit = 10) {
    const randomOffset = type === 'playlist' ? Math.floor(Math.random() * 5) : 0;
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}&offset=${randomOffset}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return [];
    const data = await res.json();
    if (type === 'playlist') return data.playlists?.items.filter(item => item !== null) || [];
    return data.tracks?.items.filter(item => item !== null) || [];
}

// MOOD
export async function searchPlaylistsByMood(query, skipAI = false) {
  const token = await getAccessToken();
  if (!token) throw new Error("No token");

  try {
    let searchTerms = query;
    let hexColor = "#1db954";

    if (!skipAI) {
        const aiData = await getAIRecommendation(query);
        searchTerms = aiData.searchTerms || query;
        hexColor = aiData.hexColor || "#1db954";
    }
    
    let items = await fetchSpotify(token, searchTerms, 'playlist');

    if (items.length === 0 && searchTerms !== query) {
        items = await fetchSpotify(token, query, 'playlist');
    }

    return { items: shuffleArray(items).slice(0, 5), aiTerms: searchTerms, moodColor: hexColor };
  } catch (error) { return { items: [], aiTerms: query, moodColor: "#1db954" }; }
}

// ARTISTA
export async function searchArtistsAndTracks(query) {
  const token = await getAccessToken();
  if (!token) throw new Error("No token");
  try {
    const artistRes = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist&limit=1`, { headers: { Authorization: `Bearer ${token}` } });
    const artistData = await artistRes.json();
    const artistItem = artistData.artists?.items?.[0];
    if (!artistItem) return { artistName: query, tracks: [] };

    const tracksRes = await fetch(`https://api.spotify.com/v1/artists/${artistItem.id}/top-tracks?market=US`, { headers: { Authorization: `Bearer ${token}` } });
    const tracksData = await tracksRes.json();

    const uniqueTracks = [];
    const seen = new Set();
    (tracksData.tracks || []).forEach(t => {
        if(!seen.has(t.name)) {
            seen.add(t.name);
            uniqueTracks.push({
                id: t.id, name: t.name, artist: t.artists[0].name,
                albumImage: t.album.images[0]?.url || t.album.images[1]?.url, 
                previewUrl: t.preview_url, 
                externalUrl: t.external_urls?.spotify
            });
        }
    });
    return { artistName: artistItem.name, tracks: shuffleArray(uniqueTracks).slice(0, 5) };
  } catch (error) { return { artistName: query, tracks: [] }; }
}

// 🎵 NUEVO: BUSCAR CANCIONES ESPECÍFICAS
export async function searchTracks(query) {
  const token = await getAccessToken();
  if (!token) throw new Error("No token");
  try {
    const tracks = await fetchSpotify(token, query, 'track', 20);
    const formattedTracks = tracks.map(t => ({
        id: t.id, name: t.name, artist: t.artists[0].name,
        albumImage: t.album.images[0]?.url || t.album.images[1]?.url,
        previewUrl: t.preview_url,
        externalUrl: t.external_urls?.spotify,
        type: 'track'
    }));
    // Filtramos duplicados por nombre+artista
    const unique = [];
    const seen = new Set();
    formattedTracks.forEach(t => {
        const key = `${t.name}-${t.artist}`;
        if(!seen.has(key)) { seen.add(key); unique.push(t); }
    });
    return { tracks: unique.slice(0, 10) }; // Top 10 resultados
  } catch (error) { return { tracks: [] }; }
}

export async function searchGlobalTop(countryCode) {
    return searchPlaylistsByMood(`Top 50 ${countryCode}`, true);
}