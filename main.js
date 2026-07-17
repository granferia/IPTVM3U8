document.addEventListener("DOMContentLoaded", () => {
    const loginPanel = document.getElementById("login-panel");
    const playerPanel = document.getElementById("player-panel");
    const urlInput = document.getElementById("url-input");
    const btnSavePlay = document.getElementById("btn-save-play");
    const videoPlayer = document.getElementById("video-player");
    const channelListContainer = document.getElementById("channel-list-container");
    
    const btnDots = document.getElementById("btn-dots");
    const dropdownMenu = document.getElementById("dropdown-menu");
    const btnNewUrl = document.getElementById("btn-new-url");
    const btnShowChannels = document.getElementById("btn-show-channels");
    const osdChannelName = document.getElementById("osd-channel-name");

    let hls = null;
    let channels = [];
    
    let focusableElements = [];
    let currentFocusIndex = 0;
    let osdTimeout = null;
    let currentChannelIndex = 0; 

    // --- BLOQUEO DE PAUSA ---
    // Si el reproductor se pausa por cualquier motivo, lo forzamos a seguir reproduciendo
    videoPlayer.addEventListener('pause', () => {
        if (!playerPanel.classList.contains("hidden") && videoPlayer.src) {
            videoPlayer.play();
        }
    });

    // Arranque inicial
    const savedUrl = localStorage.getItem("iptv_url");
    if (savedUrl) {
        loadPlaylist(savedUrl);
    } else {
        updateFocusableElements();
    }

    // --- MANEJO ESPACIAL DE FOCO ---
    function updateFocusableElements() {
        focusableElements = Array.from(document.querySelectorAll('.tv-focusable')).filter(el => {
            return el.offsetParent !== null && !el.classList.contains('hidden-focus');
        });

        if (focusableElements.length > 0 && !focusableElements.includes(document.activeElement)) {
            currentFocusIndex = 0;
            focusableElements[currentFocusIndex].focus();
        } else {
            currentFocusIndex = focusableElements.indexOf(document.activeElement);
        }
    }

    // --- LISTENER DE TECLADO / CONTROL REMOTO ---
    document.addEventListener('keydown', (e) => {
        const key = e.keyCode;
        const KEY_UP = 38;
        const KEY_DOWN = 40;
        const KEY_ENTER = 13;
        
        // Mapeo de botones de canal (Tizen y webOS/PC)
        const KEY_CH_UP_TIZEN = 427;
        const KEY_CH_DOWN_TIZEN = 428;
        const KEY_CH_UP_WEBOS = 33;   // RePág (Page Up)
        const KEY_CH_DOWN_WEBOS = 34; // AvPág (Page Down)

        if (key === KEY_CH_UP_TIZEN || key === KEY_CH_UP_WEBOS) {
            e.preventDefault();
            changeChannel(1);
            return;
        }
        
        if (key === KEY_CH_DOWN_TIZEN || key === KEY_CH_DOWN_WEBOS) {
            e.preventDefault();
            changeChannel(-1);
            return;
        }

        // Mostrar/Ocultar lista de canales al presionar Enter sobre el video
        if (key === KEY_ENTER && !playerPanel.classList.contains("hidden")) {
            if (document.activeElement === document.body || document.activeElement === videoPlayer) {
                toggleChannelList();
                return;
            }
        }

        if (focusableElements.length === 0) return;

        if (key === KEY_UP) {
            e.preventDefault();
            if (currentFocusIndex > 0) {
                currentFocusIndex--;
                focusableElements[currentFocusIndex].focus();
            }
        } 
        else if (key === KEY_DOWN) {
            e.preventDefault();
            if (currentFocusIndex < focusableElements.length - 1) {
                currentFocusIndex++;
                focusableElements[currentFocusIndex].focus();
            }
        }
        else if (key === KEY_ENTER) {
            if (document.activeElement && document.activeElement !== urlInput) {
                document.activeElement.click();
            }
        }
    });

    // --- LÓGICA DE CANALES ---
    function changeChannel(step) {
        if (channels.length === 0) return;

        currentChannelIndex += step;

        // Comportamiento cíclico (loop)
        if (currentChannelIndex >= channels.length) {
            currentChannelIndex = 0;
        } else if (currentChannelIndex < 0) {
            currentChannelIndex = channels.length - 1;
        }

        const newChannel = channels[currentChannelIndex];

        const items = document.querySelectorAll("#channel-list li");
        items.forEach(el => el.classList.remove("active"));
        if (items[currentChannelIndex]) {
            items[currentChannelIndex].classList.add("active");
            items[currentChannelIndex].scrollIntoView({ behavior: "smooth", block: "nearest" });
        }

        playStream(newChannel.url, newChannel.name);
    }

    function toggleChannelList() {
        channelListContainer.classList.toggle("hidden");
        
        if (channelListContainer.classList.contains("hidden")) {
            document.querySelectorAll("#channel-list li").forEach(el => el.classList.add("hidden-focus"));
            videoPlayer.focus();
        } else {
            document.querySelectorAll("#channel-list li").forEach(el => el.classList.remove("hidden-focus"));
            const activeChannel = document.querySelector("#channel-list li.active");
            if(activeChannel) {
                activeChannel.focus();
                activeChannel.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
        }
        updateFocusableElements();
    }

    // --- EVENTOS CLICK EN INTERFAZ ---
    btnSavePlay.addEventListener("click", () => {
        const url = urlInput.value.trim();
        if (url !== "") {
            localStorage.setItem("iptv_url", url);
            loadPlaylist(url);
        } else {
            alert("Por favor ingresa una URL válida");
        }
    });

    btnDots.addEventListener("click", () => {
        dropdownMenu.classList.toggle("hidden");
        if (dropdownMenu.classList.contains("hidden")) {
            btnNewUrl.classList.add("hidden-focus");
            btnShowChannels.classList.add("hidden-focus");
        } else {
            btnNewUrl.classList.remove("hidden-focus");
            btnShowChannels.classList.remove("hidden-focus");
        }
        updateFocusableElements();
    });

    btnShowChannels.addEventListener("click", () => {
        dropdownMenu.classList.add("hidden");
        btnNewUrl.classList.add("hidden-focus");
        btnShowChannels.classList.add("hidden-focus");
        toggleChannelList();
    });

    btnNewUrl.addEventListener("click", () => {
        localStorage.removeItem("iptv_url");
        if (hls) { hls.destroy(); }
        videoPlayer.src = "";
        
        playerPanel.classList.add("hidden");
        loginPanel.classList.remove("hidden");
        dropdownMenu.classList.add("hidden");
        btnNewUrl.classList.add("hidden-focus");
        btnShowChannels.classList.add("hidden-focus");
        
        urlInput.value = "";
        document.getElementById("channel-list").innerHTML = "";
        
        updateFocusableElements();
    });

    // --- CARGA Y PARSEO DE PLAYLIST ---
    async function loadPlaylist(url) {
        loginPanel.classList.add("hidden");
        playerPanel.classList.remove("hidden");
        
        try {
            const response = await fetch(url);
            const text = await response.text();
            
            channels = parseM3U(text);
            
            if (channels.length > 0) {
                renderChannelList();
                currentChannelIndex = 0; 
                playStream(channels[0].url, channels[0].name); 
            } else {
                alert("No se encontraron canales en esta URL.");
            }
        } catch (error) {
            console.error("Error detallado:", error);
            alert("Error: " + error.message);
            playerPanel.classList.add("hidden");
            loginPanel.classList.remove("hidden");
            updateFocusableElements();
        }
    }

    function parseM3U(m3uText) {
        const lines = m3uText.split('\n');
        const result = [];
        let currentName = "Canal Desconocido";

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith("#EXTINF")) {
                const parts = line.split(',');
                currentName = parts[parts.length - 1];
            } else if (line.startsWith("http")) {
                result.push({ name: currentName, url: line });
            }
        }
        return result;
    }

    function renderChannelList() {
        const ul = document.getElementById("channel-list");
        ul.innerHTML = "";
        channels.forEach((channel, index) => { 
            const li = document.createElement("li");
            li.textContent = channel.name;
            
            li.classList.add("tv-focusable");
            li.classList.add("hidden-focus");
            li.tabIndex = -1;
            
            li.addEventListener("click", () => {
                currentChannelIndex = index; 
                
                document.querySelectorAll("#channel-list li").forEach(el => el.classList.remove("active"));
                li.classList.add("active");
                
                playStream(channel.url, channel.name);
                toggleChannelList(); 
            });
            ul.appendChild(li);
        });
        
        if (ul.firstChild) {
            ul.firstChild.classList.add("active");
        }
    }

    // --- REPRODUCCIÓN DE VIDEO Y OSD ---
    function playStream(videoUrl, channelName) {
        osdChannelName.textContent = channelName;
        osdChannelName.classList.remove("osd-hidden");
        
        if (osdTimeout) clearTimeout(osdTimeout);
        
        osdTimeout = setTimeout(() => {
            osdChannelName.classList.add("osd-hidden");
        }, 4000);

        if (Hls.isSupported()) {
            if (hls) { hls.destroy(); }
            hls = new Hls();
            hls.loadSource(videoUrl);
            hls.attachMedia(videoPlayer);
            hls.on(Hls.Events.MANIFEST_PARSED, function() {
                videoPlayer.play();
            });
        } 
        else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
            videoPlayer.src = videoUrl;
            videoPlayer.addEventListener('loadedmetadata', function() {
                videoPlayer.play();
            });
        }
    }
});