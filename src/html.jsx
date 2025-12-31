import React, { useState, useEffect, useRef } from "react";

// --- CONFIGURACIÓN DEL SERVIDOR ---
const PROD_URL = "https://residencias-lac.vercel.app/"; 

// Esta lógica usa localhost si estás en tu PC, y la URL real 
const API_URL = window.location.hostname === "localhost" 
    ? "http://localhost:5000" 
    : PROD_URL;

// --- HELPER: Mezclar array (Shuffle) ---
const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export default function Html() {
  const [searchTerm, setSearchTerm] = useState("");
  const [playlistResult, setPlaylistResult] = useState([]); 
  const [aiInterpretation, setAiInterpretation] = useState("");
  const [artistResult, setArtistResult] = useState(null);
  const [trackResult, setTrackResult] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [mode, setMode] = useState("mood"); 
  const [bgColor, setBgColor] = useState("#1a1a1a"); 
  const [history, setHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [queue, setQueue] = useState([]);
  const [showQueue, setShowQueue] = useState(false);
  
  // Estado para el Token real de Spotify
  const [spotifyToken, setSpotifyToken] = useState("");

  const [isListening, setIsListening] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [greeting, setGreeting] = useState("");
  const [darkMode, setDarkMode] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  const [currentTrack, setCurrentTrack] = useState(null);
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);

  const countries = [ { code: "MX", name: "México", flag: "🇲🇽" }, { code: "ES", name: "España", flag: "🇪🇸" }, { code: "US", name: "USA", flag: "🇺🇸" }, { code: "BR", name: "Brasil", flag: "🇧🇷" }, { code: "KR", name: "Corea", flag: "🇰🇷" }, { code: "JP", name: "Japón", flag: "🇯🇵" }, { code: "CO", name: "Colombia", flag: "🇨🇴" }, { code: "AR", name: "Argentina", flag: "🇦🇷" } ];

  const randomPrompts = [
    "Ciberpunk hacker a las 3 AM", "Cena romántica italiana con vino", "Entrenamiento bestial modo bestia", 
    "Domingo de limpieza con energía", "Lluvia melancólica en la ventana", "Roadtrip por la costa de California", 
    "Fiesta en la piscina años 80", "Meditación en un templo zen", "Café parisino por la mañana", 
    "Vaquero espacial en Marte", "Noche de jazz en Nueva York 1950", "Perreo intenso hasta el suelo", 
    "Estudiando física cuántica lo-fi", "Caminata por el bosque mágico", "Batalla épica de videojuego final", 
    "Desayuno con diamantes elegante", "Picnic en primavera con flores", "Conduciendo en Tokio de noche (Drift)", 
    "Tarde de lluvia y libros antiguos", "Fiesta de Halloween terrorífica", "Navidad acogedora frente a la chimenea", 
    "Festival de música electrónica en la playa", "Detective privado en película Noir", "Viaje psicodélico años 60", 
    "Entrando al ring de boxeo", "Amanecer en la montaña sagrada", "Caos en la cocina preparando cena", 
    "Amor a primera vista en el metro", "Soledad en una estación espacial", "Rave en un búnker subterráneo"
  ];

  // --- 1. CARGA INICIAL Y TOKEN ---
  useEffect(() => {
    // Obtener Token REAL de tu backend
    const getToken = async () => {
        try {
            console.log(`📡 Conectando a: ${API_URL}`); // Para depuración
            const res = await fetch(`${API_URL}/api/token`);
            if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
            const data = await res.json();
            setSpotifyToken(data.token);
            console.log("✅ Conectado a Spotify API");
        } catch (e) {
            console.error("Error obteniendo token:", e);
            setError(`No se pudo conectar al servidor en ${API_URL}. Revisa la URL.`);
        }
    };
    getToken();

    const savedHistory = JSON.parse(localStorage.getItem("musicHistory")) || [];
    setHistory(savedHistory);
    const savedFavorites = JSON.parse(localStorage.getItem("musicFavorites")) || [];
    setFavorites(savedFavorites);
    const savedQueue = JSON.parse(localStorage.getItem("musicQueue")) || [];
    setQueue(savedQueue);

    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Buenos días ☀️" : hour < 19 ? "Buenas tardes 🌤️" : "Buenas noches 🌙");

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setDarkMode(mediaQuery.matches);
    const handleChange = (e) => setDarkMode(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // --- 2. FUNCIONES DE CONEXIÓN A SPOTIFY (INTERNAS) ---
  const searchSpotifyTracks = async (query, limit = 10) => {
      if (!spotifyToken) return [];
      try {
          const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`, {
              headers: { Authorization: `Bearer ${spotifyToken}` }
          });
          const data = await res.json();
          if (!data.tracks) return [];
          
          return data.tracks.items.map(track => ({
              id: track.id,
              name: track.name,
              artist: track.artists[0].name,
              albumImage: track.album.images[0]?.url,
              previewUrl: track.preview_url,
              externalUrl: track.external_urls.spotify,
              type: 'track'
          }));
      } catch (e) {
          console.error("Error en Spotify Search:", e);
          return [];
      }
  };

  const searchSpotifyArtist = async (query) => {
      if (!spotifyToken) return null;
      try {
          const resArtist = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist&limit=1`, {
              headers: { Authorization: `Bearer ${spotifyToken}` }
          });
          const dataArtist = await resArtist.json();
          const artist = dataArtist.artists?.items[0];
          if (!artist) return null;

          const resTracks = await fetch(`https://api.spotify.com/v1/artists/${artist.id}/top-tracks?market=US`, {
              headers: { Authorization: `Bearer ${spotifyToken}` }
          });
          const dataTracks = await resTracks.json();
          
          return {
              artistName: artist.name,
              tracks: dataTracks.tracks.map(track => ({
                  id: track.id,
                  name: track.name,
                  artist: track.artists[0].name,
                  albumImage: track.album.images[0]?.url,
                  previewUrl: track.preview_url,
                  externalUrl: track.external_urls.spotify,
                  type: 'track'
              }))
          };
      } catch (e) {
          console.error("Error buscando artista:", e);
          return null;
      }
  };

  // --- 3. LÓGICA PRINCIPAL (PERFORM SEARCH) ---
  const performSearch = async (term) => {
    if (!spotifyToken) { setError("Esperando conexión con Spotify..."); return; }
    
    setLoading(true); setError(""); setPlaylistResult([]); setTrackResult([]); setArtistResult(null); setSearchTerm(term);
    setShowHistory(false);
    
    if (mode === "favorites" || mode === "travel") setMode("mood");

    try {
        // A) MODO ARTISTA
        if (mode === "artist") {
            const data = await searchSpotifyArtist(term);
            if (data) {
                setArtistResult(data);
                addToHistory(term);
            } else { setError(`No encontré al artista: ${term}`); }
            setLoading(false);
            return;
        }

        // B) MODO CANCIÓN
        if (mode === "song") {
            const tracks = await searchSpotifyTracks(term, 20);
            if (tracks.length > 0) {
                setTrackResult(tracks);
                addToHistory(term);
            } else { setError("Canción no encontrada."); }
            setLoading(false);
            return;
        }

        // C) MODO MOOD / MIX (La magia de la IA)
        // 1. Pedimos la receta al backend usando API_URL dinámica
        const aiRes = await fetch(`${API_URL}/api/ai-recommendation`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userPrompt: term })
        });
        
        if (!aiRes.ok) throw new Error("Error en la IA del servidor");
        const aiData = await aiRes.json();
        
        // Obtenemos la lista de búsquedas (Smart Mix)
        const queries = aiData.queries || [term];
        const mixColor = aiData.hexColor || "#1a1a1a";
        const mixMessage = aiData.aiMessage || "Resultado";

        setBgColor(mixColor);
        setAiInterpretation(mixMessage);

        // 2. Buscamos CADA ingrediente en Spotify (Paralelo)
        const searchPromises = queries.map(q => searchSpotifyTracks(q, 6)); 
        const resultsArray = await Promise.all(searchPromises);
        
        // 3. Juntamos todo en una sola lista
        let allTracks = [];
        resultsArray.forEach(tracks => {
            allTracks = [...allTracks, ...tracks];
        });

        // 4. Mezclamos (Shuffle) para que sea un mix real
        const mixedPlaylist = shuffleArray(allTracks);

        if (mixedPlaylist.length > 0) {
            setPlaylistResult(mixedPlaylist);
            addToHistory(term);
        } else {
            setError("No encontré canciones para esta mezcla.");
        }

    } catch (err) { 
        console.error(err);
        setError(`Error de conexión con ${API_URL}. Revisa la consola.`); 
    } finally { 
        setLoading(false); 
    }
  };

  const handleSearch = (e) => { e.preventDefault(); if(searchTerm.trim()) performSearch(searchTerm); };
  
  // Helpers de UI
  const addToQueue = (e, item) => {
    e.stopPropagation();
    const newQueue = [...queue, item];
    setQueue(newQueue);
    localStorage.setItem("musicQueue", JSON.stringify(newQueue));
    setToastMessage("Añadido a la cola 🎵"); setShowToast(true); setTimeout(() => setShowToast(false), 2000);
  };
  const removeFromQueue = (index) => { const newQueue = queue.filter((_, i) => i !== index); setQueue(newQueue); localStorage.setItem("musicQueue", JSON.stringify(newQueue)); };
  const clearQueue = () => { setQueue([]); localStorage.removeItem("musicQueue"); };

  const playTrack = (track) => {
    if (!track.previewUrl) { window.open(track.externalUrl, '_blank'); return; }
    setCurrentTrack(track);
    setTimeout(() => { if(audioRef.current) { audioRef.current.src = track.previewUrl; audioRef.current.play(); } }, 100);
  };
  const closePlayer = () => { if(audioRef.current) audioRef.current.pause(); setCurrentTrack(null); };

  // Manejo de imagen (Visión)
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setSearchTerm("Analizando imagen... 📸"); 
    
    const reader = new FileReader();
    reader.onloadend = async () => {
        try {
            const res = await fetch(`${API_URL}/api/ai-vision`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ imageBase64: reader.result })
            });
            if (!res.ok) throw new Error("Error en visión");
            const aiData = await res.json();
            
            // Usamos la misma lógica de mix para la imagen
            const queries = aiData.queries || ["Pop"];
            setBgColor(aiData.hexColor || "#1a1a1a");
            setAiInterpretation(aiData.aiMessage || "Vibe visual");
            
            const searchPromises = queries.map(q => searchSpotifyTracks(q, 6));
            const resultsArray = await Promise.all(searchPromises);
            let allTracks = [];
            resultsArray.forEach(tracks => allTracks = [...allTracks, ...tracks]);
            
            setPlaylistResult(shuffleArray(allTracks));
            setMode("mood");
            addToHistory("📸 Búsqueda Visual");
            setSearchTerm("");

        } catch (e) { 
            console.error(e);
            setError("Error analizando imagen."); 
        } finally {
            setLoading(false);
        }
    };
    reader.readAsDataURL(file);
  };

  const addToHistory = (term) => {
    let newHistory = [term, ...history.filter(t => t !== term)].slice(0, 5);
    setHistory(newHistory); localStorage.setItem("musicHistory", JSON.stringify(newHistory));
  };
  const deleteHistoryItem = (e, termToDelete) => { e.stopPropagation(); const newHistory = history.filter(term => term !== termToDelete); setHistory(newHistory); localStorage.setItem("musicHistory", JSON.stringify(newHistory)); };
  
  const handleRandomSearch = () => {
    const randomPick = randomPrompts[Math.floor(Math.random() * randomPrompts.length)];
    performSearch(randomPick);
  };
  const handleVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window)) { alert("Navegador no compatible."); return; }
    const recognition = new window.webkitSpeechRecognition(); recognition.lang = 'es-ES'; recognition.continuous = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => { setSearchTerm(event.results[0][0].transcript); performSearch(event.results[0][0].transcript); };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const handleCountrySelect = async (country) => {
    setLoading(true); setMode("travel"); setSearchTerm(`Top ${country.name}`);
    try {
       const tracks = await searchSpotifyTracks(`Top 50 ${country.name}`, 20);
       setPlaylistResult(tracks);
       setAiInterpretation(`Explorando ${country.name} ${country.flag}`);
       setBgColor("#1DB954");
    } catch(e) { setError("Error viajando."); }
    setLoading(false);
  };

  const theme = {
    text: darkMode ? '#fff' : '#222',
    subText: darkMode ? '#e0e0e0' : '#555',
    bgGradient: darkMode ? '#000000' : '#f0f2f5',
    heroBg: darkMode ? 'linear-gradient(135deg, rgba(25,25,25,0.9) 0%, rgba(0,0,0,0.95) 100%)' : 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(245,245,245,0.95) 100%)',
    rightSectionOverlay: darkMode ? '#000000DD' : '#ffffffCC',
    cardBg: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    inputBg: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    borderColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    shadow: darkMode ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.1)',
    historyBg: darkMode ? '#2a2a2a' : '#fff'
  };

  const styles = {
    pageContainer: { minHeight: '100vh', background: `radial-gradient(circle at top left, ${bgColor} 0%, ${theme.bgGradient} 80%)`, color: theme.text, transition: 'background 1.5s ease', padding: '20px', display: 'flex', justifyContent: 'center' },
    heroContainer: { background: theme.heroBg, backdropFilter: 'blur(20px)', borderRadius: '24px', border: `1px solid ${bgColor}40`, boxShadow: `0 20px 60px ${theme.shadow}, 0 0 30px ${bgColor}20`, transition: 'border-color 1.5s ease, box-shadow 1.5s ease, background 0.5s' },
    rightSection: { background: `linear-gradient(to bottom right, ${bgColor}60, ${theme.rightSectionOverlay}), url('https://source.unsplash.com/random/800x800/?abstract,music') center/cover no-repeat`, transition: 'background 1.5s ease', position: 'relative', overflow: 'hidden' },
    loaderContainer: { display: 'flex', gap: '4px', justifyContent: 'center', margin: '30px 0' },
    bar: (delay) => ({ width: '5px', height: '15px', backgroundColor: '#00FF88', borderRadius: '10px', animation: `dance 1s infinite ease-in-out ${delay}s` }),
    diceBtn: { background: theme.inputBg, border: `1px solid ${theme.borderColor}`, borderRadius: '15px', color: theme.subText, padding: '6px 12px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', marginLeft: 'auto', marginBottom: '15px', transition: '0.2s' },
    gridContainer: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '15px', marginTop: '20px', width: '100%' },
    trackCard: { position: 'relative', backgroundColor: theme.cardBg, padding: '10px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', border: `1px solid ${theme.borderColor}`, transition: 'transform 0.2s', height: '100%', justifyContent: 'space-between' },
    trackImage: { width: '100%', aspectRatio: '1/1', borderRadius: '8px', objectFit: 'cover', marginBottom: '8px', boxShadow: `0 4px 8px ${theme.shadow}` },
    playlistName: { fontSize: '0.8rem', fontWeight: '600', lineHeight: '1.2', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: theme.text, textAlign: 'center' },
    miniBtn: (isActive, color) => ({ width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', color: isActive ? color : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', transition: '0.2s' }),
    floatingActions: { position: 'absolute', top: '6px', right: '6px', display: 'flex', gap: '4px' },
    linkBtnFull: { display: 'block', width: '100%', textAlign: 'center', marginTop: '8px', fontSize: '0.75rem', color: '#00FF88', textDecoration: 'none', border: '1px solid #00FF88', padding: '6px 0', borderRadius: '15px', fontWeight: '600', transition: '0.3s', cursor: 'pointer', background: 'transparent' },
    historyDropdown: { position: 'absolute', top: '100%', left: 0, width: '100%', background: theme.historyBg, borderRadius: '15px', padding: '10px', zIndex: 10, boxShadow: '0 10px 20px rgba(0,0,0,0.3)', border: `1px solid ${theme.borderColor}`, marginTop: '5px' },
    historyItem: { padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '8px', color: theme.text, fontSize: '0.9rem', marginBottom: '5px' },
    stickyPlayer: { position: 'fixed', bottom: 0, left: 0, width: '100%', backgroundColor: darkMode ? 'rgba(10,10,10,0.95)' : 'rgba(255,255,255,0.95)', backdropFilter: 'blur(15px)', borderTop: `1px solid ${bgColor}40`, padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2000, boxShadow: '0 -5px 20px rgba(0,0,0,0.2)', color: theme.text },
    playerImg: { width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover' },
    toast: { position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#00FF88', color: '#000', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold', fontSize:'0.9rem', zIndex: 3000, animation: 'fadeInUp 0.3s ease-out' },
    aiText: { color: theme.text, fontSize: '0.85rem', marginBottom: '15px', fontStyle: 'italic', backgroundColor: theme.cardBg, padding: '6px 12px', borderRadius: '20px', display: 'inline-block', backdropFilter: 'blur(5px)', borderLeft: `3px solid ${bgColor}` },
    flagGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '20px' },
    flagBtn: { fontSize: '1.8rem', background: theme.cardBg, border: 'none', borderRadius: '12px', padding: '10px', cursor: 'pointer', transition: '0.2s', display:'flex', justifyContent:'center', alignItems:'center' },
    errorMsg: { color: '#ff6b6b', marginTop: '10px', fontSize:'0.8rem', backgroundColor: 'rgba(255,0,0,0.1)', padding: '5px 10px', borderRadius: '8px', display: 'inline-block' },
    inputWrapper: { position: 'relative', display: 'flex', alignItems: 'center', backgroundColor: theme.inputBg, borderRadius: '25px', border: `1px solid ${theme.borderColor}`, flex: 1, paddingRight: '5px' },
    input: { padding: '10px 15px', border: 'none', flex: '1', background: 'transparent', color: theme.text, outline: 'none', fontSize: '0.9rem', minWidth: 0 },
    tabBtn: (isActive) => ({ padding: '6px 14px', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: '600', fontSize: '0.75rem', background: isActive ? '#00FF88' : theme.inputBg, color: isActive ? '#000' : theme.text, transition: '0.3s', boxShadow: isActive ? '0 4px 10px rgba(0,255,136,0.3)' : 'none' }),
    queueBtn: { position: 'absolute', top: '20px', right: '20px', background: 'rgba(0,0,0,0.6)', border: '1px solid #00FF88', color: '#00FF88', padding: '8px 15px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', zIndex: 5 },
    queueContainer: { position: 'fixed', top: 0, right: 0, width: '300px', height: '100%', background: darkMode ? '#111' : '#fff', boxShadow: '-5px 0 20px rgba(0,0,0,0.5)', padding: '20px', zIndex: 2500, overflowY: 'auto', transition: 'transform 0.3s ease', transform: showQueue ? 'translateX(0)' : 'translateX(100%)' },
    queueItem: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', padding: '8px', borderRadius: '8px', background: theme.cardBg },
    queueImg: { width: '40px', height: '40px', borderRadius: '4px' }
  };

  const renderLoader = () => (<div style={styles.loaderContainer}><div style={styles.bar(0)}></div><div style={styles.bar(0.1)}></div><div style={styles.bar(0.2)}></div></div>);
  const renderEmptyState = () => (<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: darkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', textAlign: 'center', padding: '20px' }}><div style={{ fontSize: '2.5rem', marginBottom: '10px', opacity: 0.3 }}>🎵</div><h3 style={{ fontSize: '1.1rem', fontWeight: '300', marginBottom: '5px', color: theme.text }}>Tu música te espera</h3><p style={{ fontSize: '0.85rem', color: theme.subText }}>Escribe, habla o sube una foto.</p></div>);

  return (
    <div className="page-container" style={styles.pageContainer}>
        {showToast && <div style={styles.toast}>{toastMessage}</div>}
        
        <button onClick={() => setShowQueue(!showQueue)} style={styles.queueBtn}>🎵 Cola ({queue.length})</button>
        <div style={styles.queueContainer} className="queue-container">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
                <h3 style={{color: theme.text, margin:0}}>Mi Cola</h3>
                <div style={{display:'flex', gap:'10px'}}>
                    <button onClick={() => clearQueue()} style={{background:'transparent',border:'none',color:'#ff6b6b',fontSize:'0.8rem',cursor:'pointer'}}>Borrar Todo</button>
                    <button onClick={() => setShowQueue(false)} style={{background:'transparent',border:'none',color: theme.text, fontSize:'1.2rem',cursor:'pointer'}}>✕</button>
                </div>
            </div>
            {queue.length === 0 ? <p style={{color: theme.subText, fontSize:'0.9rem'}}>Vacía. Añade canciones con +</p> : queue.map((item, i) => (
                <div key={i} style={styles.queueItem}>
                    <img src={item.albumImage} style={styles.queueImg} alt="art" />
                    <div style={{flex:1, overflow:'hidden'}}>
                        <div style={{color:theme.text, fontSize:'0.8rem', fontWeight:'bold', whiteSpace:'nowrap', textOverflow:'ellipsis'}}>{item.name}</div>
                        <div style={{color:theme.subText, fontSize:'0.7rem'}}>{item.artist || "Playlist"}</div>
                    </div>
                    <button onClick={() => playTrack(item)} style={{background:'none',border:'none',cursor:'pointer'}}>▶️</button>
                    <button onClick={() => removeFromQueue(i)} style={{background:'none',border:'none',color:'#ff6b6b',cursor:'pointer'}}>×</button>
                </div>
            ))}
        </div>

        <div className="hero-container" style={styles.heroContainer}>
            <div className="left-section">
                <div style={{ fontSize: '0.8rem', color: bgColor, fontWeight: '600', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px', filter: darkMode ? 'brightness(1.5)' : 'brightness(0.9)' }}>{greeting}</div>
                <h1 className="main-title">Tam IA</h1>
                <p className="subtitle" style={{color: theme.subText}}>Música inteligente: Escribe "Rock, Pop, Bad Bunny" para mezclar.</p>
                
                <div style={{ marginBottom: '15px', width: '100%' }}>
                    <button onClick={handleRandomSearch} style={styles.diceBtn}>🎲 Sorpréndeme</button>
                    <div className="tab-container">
                        <button onClick={() => setMode("mood")} style={styles.tabBtn(mode === "mood")}>✨ Mood</button>
                        <button onClick={() => setMode("song")} style={styles.tabBtn(mode === "song")}>🎵 Canción</button>
                        <button onClick={() => setMode("artist")} style={styles.tabBtn(mode === "artist")}>🎤 Artista</button>
                        <button onClick={() => setMode("travel")} style={styles.tabBtn(mode === "travel")}>🌍 Viajes</button>
                        <button onClick={() => setMode("favorites")} style={styles.tabBtn(mode === "favorites")}>❤️ Favs</button>
                    </div>
                    
                    {mode === "travel" ? (
                        <div style={styles.flagGrid}>
                            {countries.map(c => <button key={c.code} style={styles.flagBtn} onClick={() => handleCountrySelect(c)} title={c.name}>{c.flag}</button>)}
                        </div>
                    ) : (
                        <form onSubmit={handleSearch} className="search-form">
                            <div style={styles.inputWrapper}>
                                <input style={styles.input} type="text" 
                                    placeholder={mode === "mood" ? "Escribe o sube foto..." : mode === "song" ? "Nombre de la canción..." : "Busca artista..."} 
                                    value={searchTerm} 
                                    onChange={(e) => setSearchTerm(e.target.value)} 
                                    disabled={mode === "favorites"} 
                                    onFocus={() => setShowHistory(true)}
                                    onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                                />
                                {showHistory && history.length > 0 && mode !== 'favorites' && (
                                    <div style={styles.historyDropdown}>
                                        <div style={{fontSize:'0.7rem', color: theme.subText, marginBottom:'5px'}}>Recientes</div>
                                        {history.map((term, index) => (
                                            <div key={index} style={styles.historyItem} onClick={() => performSearch(term)}>
                                                <span>🕒 {term}</span>
                                                <button onClick={(e) => deleteHistoryItem(e, term)} style={{background:'none',border:'none',color:'#ff6b6b'}}>×</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <input type="file" accept="image/*" ref={fileInputRef} style={{display:'none'}} onChange={handleImageUpload} />
                                {mode === "mood" && <button type="button" onClick={() => fileInputRef.current.click()} className="icon-btn" title="Foto">📸</button>}
                                {mode !== "favorites" && <button type="button" onClick={handleVoiceSearch} className={`icon-btn ${isListening ? 'pulse' : ''}`}>{isListening ? '🛑' : '🎙️'}</button>}
                            </div>
                            <button type="submit" className="search-btn" disabled={loading || mode === "favorites"}>🔎</button>
                        </form>
                    )}
                </div>
                
                <div className="footer-info"><span>© 2025 Tam IA</span><span>Gemini • Spotify</span></div>
            </div>

            <div className="right-section" style={styles.rightSection}>
                <div className="results-overlay">
                    {loading && renderLoader()}
                    {!loading && aiInterpretation && mode === "mood" && <div style={{marginTop:'15px',textAlign:'center'}}><span style={styles.aiText}>🤖 {aiInterpretation}</span></div>}
                    
                    {!loading && (
                        <div style={{ marginTop: '15px', animation: 'fadeInUp 0.5s', width: '100%' }}>
                            {(playlistResult.length > 0 || trackResult.length > 0 || (artistResult && artistResult.tracks) || (mode === "favorites" && favorites.length > 0)) && (
                                <div style={styles.gridContainer}>
                                    {(artistResult ? artistResult.tracks : mode === "song" ? trackResult : mode === "favorites" ? favorites : playlistResult).map((item) => {
                                        const isLiked = favorites.some(fav => fav.id === item.id);
                                        const isTrack = item.previewUrl !== undefined || item.type === 'track' || artistResult || mode === "song";
                                        const image = item.albumImage || (item.images ? item.images[0]?.url : null) || "https://via.placeholder.com/150";
                                        return (
                                            <div key={item.id} style={styles.trackCard}>
                                                <div style={{position:'relative', width:'100%', marginBottom:'8px'}}>
                                                    <img src={image} alt={item.name} style={styles.trackImage} />
                                                    <div style={styles.floatingActions}>
                                                        {isTrack && <button onClick={(e) => addToQueue(e, {...item, albumImage: image})} style={styles.miniBtn(false, 'white')} title="Añadir a Cola">+</button>}
                                                        <button onClick={(e) => toggleFavorite(e, item, isTrack ? 'track' : 'playlist')} style={styles.miniBtn(isLiked, '#FF4081')}>{isLiked ? '❤️' : '🤍'}</button>
                                                    </div>
                                                </div>
                                                <div style={{width:'100%', textAlign:'center'}}>
                                                    <div style={{ fontWeight: '600', fontSize: '0.8rem', marginBottom: '6px', color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.name}>{item.name}</div>
                                                    <div style={{fontSize:'0.7rem', color: theme.subText, marginBottom:'5px'}}>{item.artist}</div>
                                                    {isTrack ? (<button onClick={() => playTrack(item)} style={styles.linkBtnFull}>{currentTrack?.id === item.id ? '🔊' : '▶️ Play'}</button>) : (<a href={item.external_urls?.spotify} target="_blank" rel="noreferrer" style={styles.linkBtnFull}>Abrir ↗</a>)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                    {!loading && !playlistResult.length && !trackResult.length && !artistResult && mode !== 'favorites' && !error && renderEmptyState()}
                </div>
            </div>
        </div>

        {currentTrack && (
            <div style={styles.stickyPlayer}>
                <div style={{display:'flex',alignItems:'center',gap:'10px',color: theme.text}}>
                    <img src={currentTrack.albumImage} style={styles.playerImg} alt="cover" />
                    <div style={{maxWidth:'120px',overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>
                        <div style={{fontWeight:'bold',fontSize:'0.8rem'}}>{currentTrack.name}</div>
                        <div style={{fontSize:'0.7rem',color: theme.subText}}>{currentTrack.artist || "Artista"}</div>
                    </div>
                </div>
                <audio ref={audioRef} controls autoPlay style={{height:'30px',maxWidth:'50%', filter: darkMode ? 'invert(1)' : 'none'}} />
                <button onClick={closePlayer} style={{background:'transparent',border:'none',color: theme.subText,fontSize:'1.2rem',cursor:'pointer'}}>&times;</button>
            </div>
        )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap');
        body { margin: 0; font-family: 'Poppins', sans-serif; background: ${darkMode ? '#000' : '#f0f2f5'}; overflow-x: hidden; color: ${darkMode ? '#fff' : '#222'}; transition: background 0.3s; }
        
        /* Estilos Base (Desktop) movidos aquí para permitir overrides */
        .page-container {
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
            box-sizing: border-box;
        }

        .hero-container {
            display: flex;
            flex-direction: row;
            max-width: 1100px;
            width: 100%;
            height: 85vh;
            max-height: 750px;
            overflow: hidden;
        }

        .left-section { 
            flex: 1; 
            padding: 30px; 
            display: flex; 
            flex-direction: column; 
            justify-content: center; 
            z-index: 2; 
            min-width: 300px; 
        }

        .right-section {
            flex: 1.2;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .results-overlay { background: ${darkMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)'}; backdrop-filter: blur(10px); width: 100%; height: 100%; padding: 20px; overflow-y: auto; box-sizing: border-box; padding-bottom: 80px; }
        .main-title { font-size: clamp(2rem, 3.5vw, 3rem); font-weight: 800; margin-bottom: 10px; line-height: 1.1; background: linear-gradient(to right, #00FF88, #8A2BE2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .tab-container { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 15px; }
        .search-form { display: flex; gap: 8px; width: 100%; }
        .icon-btn { background: transparent; border: none; cursor: pointer; font-size: 1.1rem; padding: 5px; transition: 0.2s; color: ${darkMode ? '#fff' : '#222'}; }
        .icon-btn:hover { transform: scale(1.1); }
        .search-btn { padding: 10px 20px; border-radius: 25px; border: none; background: linear-gradient(to right, #00FF88, #00CC6A); color: #000; font-weight: bold; cursor: pointer; font-size: 1rem; }
        
        @keyframes dance { 0%, 100% { height: 15px; } 50% { height: 30px; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .pulse { animation: dance 1s infinite; }

        /* DISEÑO RESPONSIVO CORREGIDO */
        @media (max-width: 850px) {
            .page-container {
                padding: 10px;
                align-items: flex-start;
                height: auto;
                min-height: 100vh;
            }

            .hero-container { 
                flex-direction: column !important; 
                height: auto !important; 
                max-height: none !important; 
                overflow: visible;
                margin-top: 20px;
                margin-bottom: 80px; /* Espacio para el player */
            }

            .left-section { 
                padding: 25px 20px; 
                min-height: auto; 
                width: 100%; 
                box-sizing: border-box; 
                min-width: 0; /* Fix flexbox overflow */
            }

            .right-section { 
                min-height: 500px; 
                width: 100%; 
                border-top: 1px solid rgba(255,255,255,0.1);
            }

            .main-title, .subtitle { text-align: center; margin-left: auto; margin-right: auto; }
            .tab-container { justify-content: center; }
            .search-form { max-width: 100%; }
            .diceBtn { margin-right: auto; margin-left: 0; }
            
            /* Ajuste de la cola en móvil */
            .queue-container { width: 85% !important; max-width: 300px; }
            
            /* Ajuste de botones en móvil */
            .flagGrid { grid-template-columns: repeat(3, 1fr) !important; }
        }
        
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: ${darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'}; }
        ::-webkit-scrollbar-thumb { background: ${darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}; border-radius: 10px; }
      `}</style>
    </div>
  );
}