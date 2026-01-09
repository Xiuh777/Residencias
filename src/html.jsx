import React, { useState, useEffect, useRef } from "react";
import { searchPlaylistsByMood, searchArtistsAndTracks, searchGlobalTop, analyzeImageAndSearch, searchTracks } from "./spotify";

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

  const [isListening, setIsListening] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [greeting, setGreeting] = useState("");
  const [darkMode, setDarkMode] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  // --- NUEVO: ESTADOS PARA PAGINACIÓN ---
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  // --------------------------------------

  const [currentTrack, setCurrentTrack] = useState(null);
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);

  const countries = [ { code: "MX", name: "México", flag: "🇲🇽" }, { code: "ES", name: "España", flag: "🇪🇸" }, { code: "US", name: "USA", flag: "🇺🇸" }, { code: "BR", name: "Brasil", flag: "🇧🇷" }, { code: "KR", name: "Corea", flag: "🇰🇷" }, { code: "JP", name: "Japón", flag: "🇯🇵" }, { code: "CO", name: "Colombia", flag: "🇨🇴" }, { code: "AR", name: "Argentina", flag: "🇦🇷" } ];

  const randomPrompts = [
    "Ciberpunk hacker a las 3 AM", "Cena romántica italiana con vino", "Entrenamiento bestial modo bestia", 
    "Domingo de limpieza con energía", "Lluvia melancólica en la ventana", "Roadtrip por la costa de California", 
    "Fiesta en la piscina años 80", "Meditación en un templo zen", "Café parisino por la mañana", 
    "Vaquero espacial en Marte", "Noche de jazz en Nueva York 1950", "Perreo intenso hasta el suelo", 
    "Estudiando física cuántica lo-fi", "Caminata por el bosque mágico", "Batalla épica de videojuego final"
  ];

  useEffect(() => {
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

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setSearchTerm("Analizando imagen... 📸"); 
    
    // --- NUEVO: RESETEO OFFSET ---
    setOffset(0);
    setHasMore(false); // Búsqueda por imagen suele ser única, desactivamos load more por ahora
    // -----------------------------

    const reader = new FileReader();
    reader.onloadend = async () => {
        try {
            const result = await analyzeImageAndSearch(reader.result);
            if (result) {
                setMode("mood"); 
                setPlaylistResult(result.items); 
                setAiInterpretation(result.aiInterpretation);
                if (result.moodColor) setBgColor(result.moodColor);
                addToHistory("📸 Búsqueda Visual");
                setSearchTerm("");
            } else { setError("No pude entender la imagen."); }
        } catch (err) { setError("Error al analizar imagen."); } finally { setLoading(false); }
    };
    reader.readAsDataURL(file);
  };

  const handleCountrySelect = async (country) => {
    setLoading(true); setMode("travel"); setSearchTerm(`Top ${country.name}`);
    
    // --- NUEVO: RESETEO OFFSET ---
    setOffset(0);
    setHasMore(true);
    // -----------------------------

    try {
        const { items, moodColor } = await searchGlobalTop(country.name, 0); // Pasamos offset 0
        setPlaylistResult(items); setAiInterpretation(`Explorando ${country.name} ${country.flag}`); setBgColor(moodColor);
    } catch (err) { setError("Error viajando."); } finally { setLoading(false); }
  };

  const performSearch = async (term) => {
    setLoading(true); setError(""); setPlaylistResult([]); setTrackResult([]); setAiInterpretation(""); setArtistResult(null); setSearchTerm(term);
    setShowHistory(false);
    
    // --- NUEVO: RESETEO OFFSET Y HASMORE ---
    setOffset(0);
    setHasMore(true);
    const initialOffset = 0;
    // --------------------------------------

    if (mode === "favorites" || mode === "travel") setMode("mood");
    
    try {
      if (mode === "artist") {
        setBgColor(darkMode ? "#1a1a1a" : "#ffffff");
        const data = await searchArtistsAndTracks(term, initialOffset);
        if (data.tracks.length > 0) { setArtistResult(data); addToHistory(term); } 
        else { setError(`No encontramos a ${data.artistName}.`); }
      } else if (mode === "song") {
        setBgColor(darkMode ? "#1a1a1a" : "#ffffff");
        const data = await searchTracks(term, initialOffset);
        if (data.tracks.length > 0) { setTrackResult(data.tracks); addToHistory(term); }
        else { setError("No encontramos esa canción."); }
      } else {
        const { items, aiTerms, moodColor } = await searchPlaylistsByMood(term, initialOffset);
        if (moodColor) setBgColor(moodColor);
        if (aiTerms && aiTerms.toLowerCase() !== term.toLowerCase()) setAiInterpretation(aiTerms);
        if (items.length > 0) { setPlaylistResult(items); addToHistory(term); } 
        else { setError("No encontramos playlists."); }
      }
    } catch (err) { setError("Error de conexión."); } finally { setLoading(false); }
  };

  // --- NUEVA FUNCIÓN: CARGAR MÁS ---
  const handleLoadMore = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    const nextOffset = offset + 20; // Asumimos saltos de 20
    const term = searchTerm || (mode === 'travel' ? aiInterpretation.split(" ")[1] : ""); // Recuperar término si es viaje

    try {
        let newItems = [];
        if (mode === "artist") {
            const data = await searchArtistsAndTracks(searchTerm, nextOffset);
            if (data && data.tracks.length > 0) {
                setArtistResult(prev => ({...prev, tracks: [...prev.tracks, ...data.tracks]}));
                newItems = data.tracks;
            }
        } else if (mode === "song") {
            const data = await searchTracks(searchTerm, nextOffset);
            if (data && data.tracks.length > 0) {
                setTrackResult(prev => [...prev, ...data.tracks]);
                newItems = data.tracks;
            }
        } else if (mode === "mood") {
            // Nota: Para mood a veces requerimos el término AI, usaremos searchTerm por defecto
            const { items } = await searchPlaylistsByMood(searchTerm || aiInterpretation, nextOffset);
            if (items && items.length > 0) {
                setPlaylistResult(prev => [...prev, ...items]);
                newItems = items;
            }
        } else if (mode === "travel") {
             // Extraer nombre del país del estado actual si es necesario, o usar searchTerm
             const countryName = searchTerm.replace("Top ", ""); 
             const { items } = await searchGlobalTop(countryName, nextOffset);
             if (items && items.length > 0) {
                setPlaylistResult(prev => [...prev, ...items]);
                newItems = items;
            }
        }

        if (newItems.length === 0) {
            setHasMore(false);
            setToastMessage("No hay más resultados 🛑");
            setShowToast(true); setTimeout(() => setShowToast(false), 2000);
        } else {
            setOffset(nextOffset);
        }

    } catch (err) {
        console.error("Error cargando más", err);
        setHasMore(false);
    } finally {
        setLoading(false);
    }
  };
  // --------------------------------

  const handleSearch = (e) => { e.preventDefault(); if(searchTerm.trim()) performSearch(searchTerm); };
  
  const toggleFavorite = (e, item, type) => {
    e.stopPropagation(); e.preventDefault();
    const exists = favorites.find(fav => fav.id === item.id);
    let newFavs = exists ? favorites.filter(fav => fav.id !== item.id) : [...favorites, { ...item, type }];
    setFavorites(newFavs); localStorage.setItem("musicFavorites", JSON.stringify(newFavs));
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

  const handleShare = async (e, item) => {
    e.stopPropagation(); 
    const shareUrl = item.external_urls?.spotify || item.externalUrl || item.previewUrl;
    const shareData = { title: `Escucha ${item.name} en Tam IA`, text: `¡Mira esta canción que encontré: "${item.name}" de ${item.artist}! 🎵`, url: shareUrl };
    if (navigator.share) {
        try { await navigator.share(shareData); setToastMessage("¡Compartido con éxito! 🚀"); setShowToast(true); setTimeout(() => setShowToast(false), 2000); } catch (err) { console.log("Cancelado", err); }
    } else {
        try { await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`); setToastMessage("Enlace copiado al portapapeles 📋"); setShowToast(true); setTimeout(() => setShowToast(false), 2000); } catch (err) { setToastMessage("No se pudo compartir ❌"); setShowToast(true); setTimeout(() => setShowToast(false), 2000); }
    }
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
    pageContainer: { minHeight: '100vh', background: `radial-gradient(circle at top left, ${bgColor} 0%, ${theme.bgGradient} 80%)`, color: theme.text, transition: 'background 1.5s ease' },
    heroContainer: { background: theme.heroBg, backdropFilter: 'blur(20px)', borderRadius: '24px', border: `1px solid ${bgColor}40`, boxShadow: `0 20px 60px ${theme.shadow}, 0 0 30px ${bgColor}20`, transition: 'border-color 1.5s ease, box-shadow 1.5s ease, background 0.5s' },
    rightSection: { background: `linear-gradient(to bottom right, ${bgColor}60, ${theme.rightSectionOverlay}), url('https://source.unsplash.com/random/800x800/?abstract,music') center/cover no-repeat`, transition: 'background 1.5s ease', position: 'relative', overflow: 'hidden' },
    loaderContainer: { display: 'flex', gap: '4px', justifyContent: 'center', margin: '30px 0' },
    bar: (delay) => ({ width: '5px', height: '15px', backgroundColor: '#00FF88', borderRadius: '10px', animation: `dance 1s infinite ease-in-out ${delay}s` }),
    diceBtn: { background: theme.inputBg, border: `1px solid ${theme.borderColor}`, borderRadius: '15px', color: theme.subText, padding: '6px 12px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', marginLeft: 'auto', marginBottom: '15px', transition: '0.2s' },
    gridContainer: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '15px', marginTop: '20px', width: '100%' },
    trackCard: { position: 'relative', backgroundColor: theme.cardBg, padding: '10px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', border: `1px solid ${theme.borderColor}`, transition: 'transform 0.2s', height: '100%', justifyContent: 'space-between' },
    trackImage: { width: '100%', aspectRatio: '1/1', borderRadius: '8px', objectFit: 'cover', marginBottom: '8px', boxShadow: `0 4px 8px ${theme.shadow}` },
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
    inputWrapper: { position: 'relative', display: 'flex', alignItems: 'center', backgroundColor: theme.inputBg, borderRadius: '25px', border: `1px solid ${theme.borderColor}`, flex: 1, paddingRight: '5px' },
    input: { padding: '10px 15px', border: 'none', flex: '1', background: 'transparent', color: theme.text, outline: 'none', fontSize: '0.9rem', minWidth: 0 },
    tabBtn: (isActive) => ({ padding: '6px 14px', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: '600', fontSize: '0.75rem', background: isActive ? '#00FF88' : theme.inputBg, color: isActive ? '#000' : theme.text, transition: '0.3s', boxShadow: isActive ? '0 4px 10px rgba(0,255,136,0.3)' : 'none' }),
    queueBtn: { position: 'absolute', top: '20px', right: '20px', background: 'rgba(0,0,0,0.6)', border: '1px solid #00FF88', color: '#00FF88', padding: '8px 15px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', zIndex: 5 },
    queueContainer: { position: 'fixed', top: 0, right: 0, width: '300px', height: '100%', background: darkMode ? '#111' : '#fff', boxShadow: '-5px 0 20px rgba(0,0,0,0.5)', padding: '20px', zIndex: 2500, overflowY: 'auto', transition: 'transform 0.3s ease', transform: showQueue ? 'translateX(0)' : 'translateX(100%)' },
    queueItem: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', padding: '8px', borderRadius: '8px', background: theme.cardBg },
    queueImg: { width: '40px', height: '40px', borderRadius: '4px' },
    // --- NUEVO ESTILO ---
    loadMoreBtn: { display: 'block', margin: '20px auto', padding: '10px 30px', background: 'transparent', border: '1px solid #00FF88', color: theme.text, borderRadius: '25px', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s' }
  };

  const renderLoader = () => (<div style={styles.loaderContainer}><div style={styles.bar(0)}></div><div style={styles.bar(0.1)}></div><div style={styles.bar(0.2)}></div></div>);
  const renderEmptyState = () => (<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: darkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', textAlign: 'center', padding: '20px' }}><div style={{ fontSize: '2.5rem', marginBottom: '10px', opacity: 0.3 }}>🎵</div><h3 style={{ fontSize: '1.1rem', fontWeight: '300', marginBottom: '5px', color: theme.text }}>Tu música te espera</h3><p style={{ fontSize: '0.85rem', color: theme.subText }}>Escribe, habla o sube una foto.</p></div>);

  // Variable auxiliar para saber si hay resultados visibles
  const hasResults = playlistResult.length > 0 || trackResult.length > 0 || (artistResult && artistResult.tracks && artistResult.tracks.length > 0);

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
                <p className="subtitle" style={{color: theme.subText}}>Música inteligente: Texto, Voz, Imagen y Viajes.</p>
                
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
                    {loading && playlistResult.length === 0 && !artistResult && trackResult.length === 0 && renderLoader()} 
                    
                    {!loading && aiInterpretation && mode === "mood" && <div style={{marginTop:'15px',textAlign:'center'}}><span style={styles.aiText}>🤖 {aiInterpretation}</span></div>}
                    
                    {(playlistResult.length > 0 || trackResult.length > 0 || (artistResult && artistResult.tracks) || (mode === "favorites" && favorites.length > 0)) && (
                        <div style={{ marginTop: '15px', animation: 'fadeInUp 0.5s', width: '100%' }}>
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
                                                    <button onClick={(e) => handleShare(e, item)} style={{...styles.miniBtn(false, 'white'), marginLeft:'4px'}} title="Compartir">↗️</button>
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

                            {/* --- NUEVO: BOTÓN DE CARGAR MÁS --- */}
                            {hasMore && mode !== 'favorites' && hasResults && !loading && (
                                <button onClick={handleLoadMore} style={styles.loadMoreBtn}>
                                    ➕ Cargar más
                                </button>
                            )}
                            {loading && hasResults && renderLoader()}
                            {/* ---------------------------------- */}
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
                margin-bottom: 80px; 
            }

            .left-section { 
                padding: 25px 20px; 
                min-height: auto; 
                width: 100%; 
                box-sizing: border-box; 
                min-width: 0; 
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
            .queue-container { width: 85% !important; max-width: 300px; }
            .flagGrid { grid-template-columns: repeat(3, 1fr) !important; }
        }
        
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: ${darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'}; }
        ::-webkit-scrollbar-thumb { background: ${darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}; border-radius: 10px; }
      `}</style>
    </div>
  );
}