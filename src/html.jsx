import React, { useState, useEffect, useRef } from "react";
import { searchPlaylistsByMood, searchArtistsAndTracks, searchGlobalTop, analyzeImageAndSearch } from "./spotify";

export default function Html() {
  const [searchTerm, setSearchTerm] = useState("");
  const [playlistResult, setPlaylistResult] = useState([]); 
  const [aiInterpretation, setAiInterpretation] = useState("");
  const [artistResult, setArtistResult] = useState(null);   
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [mode, setMode] = useState("mood"); 
  const [bgColor, setBgColor] = useState("#1a1a1a"); 
  const [history, setHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [greeting, setGreeting] = useState("");
  
  // NUEVO: Estado para Modo Oscuro/Claro
  const [darkMode, setDarkMode] = useState(true);

  const [currentTrack, setCurrentTrack] = useState(null);
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);

  const countries = [
    { code: "MX", name: "México", flag: "🇲🇽" }, { code: "ES", name: "España", flag: "🇪🇸" },
    { code: "US", name: "USA", flag: "🇺🇸" }, { code: "BR", name: "Brasil", flag: "🇧🇷" },
    { code: "KR", name: "Corea", flag: "🇰🇷" }, { code: "JP", name: "Japón", flag: "🇯🇵" },
    { code: "CO", name: "Colombia", flag: "🇨🇴" }, { code: "AR", name: "Argentina", flag: "🇦🇷" }
  ];

  useEffect(() => {
    const savedHistory = JSON.parse(localStorage.getItem("musicHistory")) || [];
    setHistory(savedHistory);
    const savedFavorites = JSON.parse(localStorage.getItem("musicFavorites")) || [];
    setFavorites(savedFavorites);
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Buenos días ☀️" : hour < 19 ? "Buenas tardes 🌤️" : "Buenas noches 🌙");

    // DETECCIÓN AUTOMÁTICA DEL TEMA DEL SISTEMA
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setDarkMode(mediaQuery.matches); // Establecer valor inicial

    const handleChange = (e) => setDarkMode(e.matches);
    mediaQuery.addEventListener('change', handleChange); // Escuchar cambios en vivo
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

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
    const reader = new FileReader();
    reader.onloadend = async () => {
        try {
            const result = await analyzeImageAndSearch(reader.result);
            if (result) {
                setMode("mood"); setPlaylistResult(result.items); setAiInterpretation(result.aiInterpretation);
                if (result.moodColor) setBgColor(result.moodColor);
                addToHistory("📸 Imagen");
            } else { setError("No pude entender la imagen."); }
        } catch (err) { setError("Error al analizar."); } finally { setLoading(false); }
    };
    reader.readAsDataURL(file);
  };

  const handleCountrySelect = async (country) => {
    setLoading(true); setMode("travel"); setSearchTerm(`Top ${country.name}`);
    try {
        const { items, moodColor } = await searchGlobalTop(country.name);
        setPlaylistResult(items); setAiInterpretation(`Explorando ${country.name} ${country.flag}`); setBgColor(moodColor);
    } catch (err) { setError("Error viajando."); } finally { setLoading(false); }
  };

  const performSearch = async (term) => {
    setLoading(true); setError(""); setPlaylistResult([]); setAiInterpretation(""); setArtistResult(null); setSearchTerm(term);
    if (mode === "favorites" || mode === "travel") setMode("mood");
    try {
      if (mode === "artist") {
        setBgColor(darkMode ? "#1a1a1a" : "#ffffff"); // Reset color base según tema
        const data = await searchArtistsAndTracks(term);
        if (data.tracks.length > 0) { setArtistResult(data); addToHistory(term); } 
        else { setError(`No encontramos a ${data.artistName}.`); }
      } else {
        const { items, aiTerms, moodColor } = await searchPlaylistsByMood(term);
        if (moodColor) setBgColor(moodColor);
        if (aiTerms && aiTerms.toLowerCase() !== term.toLowerCase()) setAiInterpretation(aiTerms);
        if (items.length > 0) { setPlaylistResult(items); addToHistory(term); } 
        else { setError("No encontramos playlists."); }
      }
    } catch (err) { setError("Error de conexión."); } finally { setLoading(false); }
  };

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
  const clearAllHistory = () => { if(confirm("¿Borrar todo?")) { setHistory([]); localStorage.removeItem("musicHistory"); } };
  const handleRandomSearch = () => {
    const prompts = ["Ciberpunk 2077", "Café parisino", "Entrenamiento Rocky", "Playa ibiza sunset", "Meditación en Nepal", "Cena romántica", "Fiesta 90s"];
    performSearch(prompts[Math.floor(Math.random() * prompts.length)]);
  };
  const shareItem = (e, item, type) => {
    e.stopPropagation(); e.preventDefault();
    const link = type === 'playlist' ? item.external_urls?.spotify : item.externalUrl;
    const text = `🎵 Tam IA: "${item.name}"\n🔗 ${link}`;
    navigator.clipboard.writeText(text).then(() => { setToastMessage("¡Enlace copiado! 📤"); setShowToast(true); setTimeout(() => setShowToast(false), 3000); });
  };
  const handleShareAll = () => {
    const text = mode === "mood" ? `🤖 Tam IA recomendó música para "${searchTerm}".` : `🎤 Top de ${artistResult.artistName} en Tam IA.`;
    navigator.clipboard.writeText(text).then(() => { setToastMessage("Resumen copiado 📋"); setShowToast(true); setTimeout(() => setShowToast(false), 3000); });
  };
  const handleVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window)) { alert("Navegador no compatible."); return; }
    const recognition = new window.webkitSpeechRecognition(); recognition.lang = 'es-ES'; recognition.continuous = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => { setSearchTerm(event.results[0][0].transcript); performSearch(event.results[0][0].transcript); };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  // --- VARIABLES DE TEMA DINÁMICAS ---
  const theme = {
    text: darkMode ? '#fff' : '#222',
    subText: darkMode ? '#e0e0e0' : '#555',
    bgGradient: darkMode ? '#000000' : '#f0f2f5', // Fondo negro o gris muy claro
    heroBg: darkMode 
        ? 'linear-gradient(135deg, rgba(25,25,25,0.9) 0%, rgba(0,0,0,0.95) 100%)' 
        : 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(245,245,245,0.95) 100%)',
    rightSectionOverlay: darkMode ? '#000000DD' : '#ffffffCC',
    cardBg: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    inputBg: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    borderColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    shadow: darkMode ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.1)',
    historyBg: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    historyText: darkMode ? '#bbb' : '#666'
  };

  const styles = {
    pageContainer: {
        minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center',
        background: `radial-gradient(circle at top left, ${bgColor} 0%, ${theme.bgGradient} 80%)`, // Adapta el fondo base
        padding: '20px', boxSizing: 'border-box', transition: 'background 1.5s ease', color: theme.text
    },
    heroContainer: {
        display: 'flex', flexDirection: 'row', maxWidth: '1100px', width: '100%', 
        height: '85vh', maxHeight: '750px',
        background: theme.heroBg,
        backdropFilter: 'blur(20px)', borderRadius: '24px', 
        border: `1px solid ${bgColor}40`, 
        boxShadow: `0 20px 60px ${theme.shadow}, 0 0 30px ${bgColor}20`, 
        overflow: 'hidden', transition: 'border-color 1.5s ease, box-shadow 1.5s ease, background 0.5s'
    },
    rightSection: {
        flex: 1.2, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden',
        background: `linear-gradient(to bottom right, ${bgColor}60, ${theme.rightSectionOverlay}), url('https://source.unsplash.com/random/800x800/?abstract,music') center/cover no-repeat`,
        transition: 'background 1.5s ease'
    },
    
    loaderContainer: { display: 'flex', gap: '4px', justifyContent: 'center', margin: '30px 0' },
    bar: (delay) => ({ width: '5px', height: '15px', backgroundColor: '#00FF88', borderRadius: '10px', animation: `dance 1s infinite ease-in-out ${delay}s` }),
    
    diceBtn: { background: theme.inputBg, border: `1px solid ${theme.borderColor}`, borderRadius: '15px', color: theme.subText, padding: '6px 12px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', marginLeft: 'auto', marginBottom: '15px', transition: '0.2s' },
    
    gridContainer: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '15px', marginTop: '20px', width: '100%' },
    
    trackCard: { 
        position: 'relative', backgroundColor: theme.cardBg, padding: '10px', borderRadius: '12px', 
        display: 'flex', flexDirection: 'column', alignItems: 'center', 
        border: `1px solid ${theme.borderColor}`, transition: 'transform 0.2s', height: '100%', justifyContent: 'space-between' 
    },
    trackImage: { width: '100%', aspectRatio: '1/1', borderRadius: '8px', objectFit: 'cover', marginBottom: '8px', boxShadow: `0 4px 8px ${theme.shadow}` },
    playlistName: { fontSize: '0.8rem', fontWeight: '600', lineHeight: '1.2', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: theme.text, textAlign: 'center' },
    
    miniBtn: (isActive, color) => ({ width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', color: isActive ? color : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', transition: '0.2s' }),
    floatingActions: { position: 'absolute', top: '6px', right: '6px', display: 'flex', gap: '4px' },
    
    linkBtnFull: { display: 'block', width: '100%', textAlign: 'center', marginTop: '8px', fontSize: '0.75rem', color: '#00FF88', textDecoration: 'none', border: '1px solid #00FF88', padding: '6px 0', borderRadius: '15px', fontWeight: '600', transition: '0.3s', cursor: 'pointer', background: 'transparent' },
    
    historyContainer: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' },
    historyChip: { fontSize: '0.7rem', padding: '4px 10px', borderRadius: '12px', backgroundColor: theme.historyBg, color: theme.historyText, cursor: 'pointer', border: `1px solid ${theme.borderColor}`, transition: '0.2s', display: 'flex', alignItems: 'center', gap: '6px' },
    
    stickyPlayer: { position: 'fixed', bottom: 0, left: 0, width: '100%', backgroundColor: darkMode ? 'rgba(10,10,10,0.95)' : 'rgba(255,255,255,0.95)', backdropFilter: 'blur(15px)', borderTop: `1px solid ${bgColor}40`, padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2000, boxShadow: '0 -5px 20px rgba(0,0,0,0.2)', color: theme.text },
    playerImg: { width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover' },
    
    toast: { position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#00FF88', color: '#000', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold', fontSize:'0.9rem', zIndex: 3000, animation: 'fadeInUp 0.3s ease-out' },
    aiText: { color: theme.text, fontSize: '0.85rem', marginBottom: '15px', fontStyle: 'italic', backgroundColor: theme.cardBg, padding: '6px 12px', borderRadius: '20px', display: 'inline-block', backdropFilter: 'blur(5px)', borderLeft: `3px solid ${bgColor}` },
    flagGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '20px' },
    flagBtn: { fontSize: '1.8rem', background: theme.cardBg, border: 'none', borderRadius: '12px', padding: '10px', cursor: 'pointer', transition: '0.2s', display:'flex', justifyContent:'center', alignItems:'center' },
    errorMsg: { color: '#ff6b6b', marginTop: '10px', fontSize:'0.8rem', backgroundColor: 'rgba(255,0,0,0.1)', padding: '5px 10px', borderRadius: '8px', display: 'inline-block' },
    
    // El input necesita estilos específicos para modo claro
    inputWrapper: { display: 'flex', alignItems: 'center', backgroundColor: theme.inputBg, borderRadius: '25px', border: `1px solid ${theme.borderColor}`, flex: 1, paddingRight: '5px' },
    input: { padding: '10px 15px', border: 'none', flex: '1', background: 'transparent', color: theme.text, outline: 'none', fontSize: '0.9rem', minWidth: 0 },
    
    tabBtn: (isActive) => ({ padding: '6px 14px', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: '600', fontSize: '0.75rem', background: isActive ? '#00FF88' : theme.inputBg, color: isActive ? '#000' : theme.text, transition: '0.3s', boxShadow: isActive ? '0 4px 10px rgba(0,255,136,0.3)' : 'none' }),
  };

  const renderLoader = () => (<div style={styles.loaderContainer}><div style={styles.bar(0)}></div><div style={styles.bar(0.1)}></div><div style={styles.bar(0.2)}></div></div>);
  const renderEmptyState = () => (<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: darkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', textAlign: 'center', padding: '20px' }}><div style={{ fontSize: '2.5rem', marginBottom: '10px', opacity: 0.3 }}>🎵</div><h3 style={{ fontSize: '1.1rem', fontWeight: '300', marginBottom: '5px', color: theme.text }}>Tu música te espera</h3><p style={{ fontSize: '0.85rem', color: theme.subText }}>Escribe, habla o sube una foto.</p></div>);

  return (
    <div style={styles.pageContainer}>
        {showToast && <div style={styles.toast}>{toastMessage}</div>}
        <div style={styles.heroContainer} className="hero-responsive">
            {/* IZQUIERDA */}
            <div className="left-section">
                <div style={{ fontSize: '0.8rem', color: bgColor, fontWeight: '600', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px', filter: darkMode ? 'brightness(1.5)' : 'brightness(0.9)' }}>{greeting}</div>
                <h1 className="main-title">Tam IA</h1>
                <p className="subtitle" style={{color: theme.subText}}>Música inteligente: Texto, Voz, Imagen y Viajes.</p>
                
                <div style={{ marginBottom: '15px', width: '100%' }}>
                    <button onClick={handleRandomSearch} style={styles.diceBtn}>🎲 Sorpréndeme</button>
                    <div className="tab-container">
                        <button onClick={() => setMode("mood")} style={styles.tabBtn(mode === "mood")}>✨ Mood</button>
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
                                <input style={styles.input} type="text" placeholder={mode === "mood" ? "Escribe o sube foto..." : "Busca artista..."} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} disabled={mode === "favorites"} />
                                <input type="file" accept="image/*" ref={fileInputRef} style={{display:'none'}} onChange={handleImageUpload} />
                                {mode === "mood" && <button type="button" onClick={() => fileInputRef.current.click()} className="icon-btn" title="Foto">📸</button>}
                                {mode !== "favorites" && <button type="button" onClick={handleVoiceSearch} className={`icon-btn ${isListening ? 'pulse' : ''}`}>{isListening ? '🛑' : '🎙️'}</button>}
                            </div>
                            <button type="submit" className="search-btn" disabled={loading || mode === "favorites"}>🔎</button>
                        </form>
                    )}
                </div>
                
                {history.length > 0 && mode !== 'favorites' && mode !== 'travel' && (
                    <div style={styles.historyContainer}>
                        {history.map((term, index) => (
                            <div key={index} style={styles.historyChip} onClick={() => performSearch(term)}>
                                {term} <button onClick={(e) => deleteHistoryItem(e, term)} style={{background:'transparent',border:'none',color:'#ff6b6b',cursor:'pointer',fontSize:'0.9rem',padding:'0'}}>×</button>
                            </div>
                        ))}
                        <button onClick={clearAllHistory} style={{background:'transparent',border:'none',color:'#ff6b6b',cursor:'pointer',fontSize:'0.7rem',opacity:0.7}}>🗑️</button>
                    </div>
                )}
                {error && <p style={styles.errorMsg}>{error}</p>}
                
                <div className="footer-info">
                    <span>© 2025 Tam IA</span><span>Gemini • Spotify</span>
                </div>
            </div>

            {/* DERECHA */}
            <div style={styles.rightSection} className="right-section-responsive">
                <div className="results-overlay">
                    {loading && renderLoader()}
                    {!loading && (playlistResult.length > 0 || artistResult) && mode !== "favorites" && <div style={{display:'flex',justifyContent:'center',gap:'10px',marginTop:'15px'}}><button onClick={() => performSearch(searchTerm)} className="action-btn-main">🔀 Mezclar</button><button onClick={handleShareAll} className="action-btn-sec">📤 Copiar</button></div>}
                    {!loading && aiInterpretation && mode === "mood" && <div style={{marginTop:'15px',textAlign:'center'}}><span style={styles.aiText}>🤖 {aiInterpretation}</span></div>}
                    
                    {/* RESULTADOS GRID */}
                    {!loading && (playlistResult.length > 0 || (artistResult && artistResult.tracks) || (mode === "favorites" && favorites.length > 0)) && (
                        <div style={{ marginTop: '15px', animation: 'fadeInUp 0.5s', width: '100%' }}>
                            {mode === "favorites" && favorites.length === 0 && <p style={{textAlign:'center',color: theme.subText, fontSize:'0.9rem'}}>Aún no tienes favoritos.</p>}
                            {artistResult && <h3 style={{textAlign:'center',color: theme.text, marginBottom:'10px',fontSize:'1.1rem'}}>Top de {artistResult.artistName}</h3>}
                            
                            <div style={styles.gridContainer}>
                                {(artistResult ? artistResult.tracks : mode === "favorites" ? favorites : playlistResult).map((item) => {
                                    const isLiked = favorites.some(fav => fav.id === item.id);
                                    const isTrack = item.previewUrl !== undefined || item.type === 'track' || artistResult;
                                    const image = item.albumImage || (item.images ? item.images[0]?.url : null) || "https://via.placeholder.com/150";
                                    return (
                                        <div key={item.id} style={styles.trackCard}>
                                            <div style={{position:'relative', width:'100%', marginBottom:'8px'}}>
                                                <img src={image} alt={item.name} style={styles.trackImage} />
                                                <div style={styles.floatingActions}>
                                                    <button onClick={(e) => toggleFavorite(e, item, isTrack ? 'track' : 'playlist')} style={styles.miniBtn(isLiked, '#FF4081')}>{isLiked ? '❤️' : '🤍'}</button>
                                                </div>
                                            </div>
                                            <div style={{width:'100%', textAlign:'center'}}>
                                                <div style={{ fontWeight: '600', fontSize: '0.8rem', marginBottom: '6px', color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.name}>{item.name}</div>
                                                {isTrack ? (
                                                    <button onClick={() => playTrack(item)} style={styles.linkBtnFull}>{currentTrack?.id === item.id ? '🔊' : '▶️ Play'}</button>
                                                ) : (
                                                    <a href={item.external_urls?.spotify} target="_blank" rel="noreferrer" style={styles.linkBtnFull}>Abrir ↗</a>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    {!loading && !playlistResult.length && !artistResult && mode !== 'favorites' && !error && renderEmptyState()}
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
        .left-section { flex: 1; padding: 30px; display: flex; flex-direction: column; justify-content: center; z-index: 2; min-width: 300px; }
        .results-overlay { background: ${darkMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)'}; backdrop-filter: blur(10px); width: 100%; height: 100%; padding: 20px; overflow-y: auto; box-sizing: border-box; padding-bottom: 80px; }
        .main-title { font-size: clamp(2rem, 3.5vw, 3rem); font-weight: 800; margin-bottom: 10px; line-height: 1.1; background: linear-gradient(to right, #00FF88, #8A2BE2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .tab-container { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 15px; }
        .search-form { display: flex; gap: 8px; width: 100%; }
        .icon-btn { background: transparent; border: none; cursor: pointer; font-size: 1.1rem; padding: 5px; transition: 0.2s; color: ${darkMode ? '#fff' : '#222'}; }
        .icon-btn:hover { transform: scale(1.1); }
        .search-btn { padding: 10px 20px; border-radius: 25px; border: none; background: linear-gradient(to right, #00FF88, #00CC6A); color: #000; font-weight: bold; cursor: pointer; font-size: 1rem; }
        
        .action-btn-main { padding: 6px 15px; border-radius: 20px; border: 1px solid #00FF88; background: transparent; color: #00FF88; font-weight: 600; cursor: pointer; font-size: 0.8rem; transition: 0.3s; }
        .action-btn-main:hover { background: #00FF88; color: #000; }
        .action-btn-sec { padding: 6px 15px; border-radius: 20px; border: none; background: ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}; color: ${darkMode ? '#fff' : '#222'}; font-weight: 600; cursor: pointer; font-size: 0.8rem; }
        .footer-info { margin-top: auto; padding-top: 15px; border-top: 1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}; width: 100%; display: flex; justify-content: space-between; color: ${darkMode ? '#888' : '#666'}; font-size: 0.7rem; }

        @keyframes dance { 0%, 100% { height: 15px; } 50% { height: 30px; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .pulse { animation: dance 1s infinite; }

        @media (max-width: 850px) {
            .hero-responsive { flex-direction: column; height: auto !important; max-height: none !important; margin-top: 10px; margin-bottom: 10px; }
            .left-section { padding: 25px 20px; min-height: auto; width: 100%; box-sizing: border-box; }
            .right-section-responsive { min-height: 500px; width: 100%; }
            .main-title, .subtitle { text-align: center; margin-left: auto; margin-right: auto; }
            .tab-container { justify-content: center; }
            .search-form { max-width: 100%; }
            .diceBtn { margin-right: auto; margin-left: 0; }
        }
        
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: ${darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'}; }
        ::-webkit-scrollbar-thumb { background: ${darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}; border-radius: 10px; }
      `}</style>
    </div>
  );
}