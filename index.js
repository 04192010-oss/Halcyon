let currentLyrics = [];

const fileInput = document.getElementById("fileInput");
const albumRow = document.getElementById("albumRow");
const songRow = document.getElementById("songRow");
const searchInput = document.getElementById("searchInput");

const audioPlayer = document.getElementById("audioPlayer");
const playBtn = document.getElementById("PlayBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const currentTitle = document.getElementById("currentTitle");
const currentArtist = document.getElementById("currentArtist");
const playerArt = document.getElementById("playerArt");

const progressBar = document.getElementById("progressBar");
const currentTimeEl = document.getElementById("currentTime");
const durationText = document.getElementById("duration");
const volumeSlider = document.getElementById("volumeSlider");


let db;
const DB_NAME = "HalcyonMusic";
const DB_VERSION = 1;

function initDB() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
        db = event.target.result;
        if (!db.objectStoreNames.contains("songs")) {
            db.createObjectStore("songs", { keyPath: "id", autoIncrement: true });
        }
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        loadSavedSongs();
    };

    request.onerror = () => console.error("IndexedDB Error");
}


function loadSavedSongs() {
    const transaction = db.transaction("songs", "readonly");
    const store = transaction.objectStore("songs");
    const request = store.getAll();

    request.onsuccess = () => {
        allSongs = request.result || [];

        for (let key in albums) {
            delete albums[key];
        }

        allSongs.forEach(song => {
            if (song.imageBlob) {
                song.imageUrl = URL.createObjectURL(song.imageBlob);
            } else {
                song.imageUrl = "https://via.placeholder.com/300x300/2a2a44/ffffff?text=No+Cover";
            }

            if (!albums[song.album]) {
                albums[song.album] = [];
            }

            albums[song.album].push(song);
        });

        currentSongs = allSongs;

        renderAlbums();
        renderAllSongs();
    };
}


function saveSong(song) {
    const transaction = db.transaction("songs", "readwrite");
    const store = transaction.objectStore("songs");
    store.add(song);
}


const albums = {};
let allSongs = [];
let currentSongs = [];
let currentIndex = 0;


function formatTime(seconds) {
    if (isNaN(seconds) || seconds === Infinity) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}


fileInput.addEventListener("change", (event) => {
    const files = event.target.files;
    const audioFiles = Array.from(files).filter(f => f.type.startsWith("audio/"));

    audioFiles.forEach(file => {
        jsmediatags.read(file, {
            onSuccess: (tag) => {
                const title = tag.tags.title || file.name.replace(/\.[^/.]+$/, "");
                const artist = tag.tags.artist || "Unknown Artist";
                const albumName = tag.tags.album || "Unknown Album";
                const picture = tag.tags.picture;

                let imageUrl = "https://via.placeholder.com/300x300/2a2a44/ffffff?text=No+Cover";
                let imageBlob = null;

                if (picture) {
                    imageBlob = new Blob([new Uint8Array(picture.data)], { type: picture.format });
                    imageUrl = URL.createObjectURL(imageBlob);
                }

                const song = {
                    title,
                    artist,
                    album: albumName,
                    fileName: file.name,
                    fileType: file.type,
                    fileData: file,
                    imageBlob: imageBlob,
                    imageUrl: imageUrl
                };

                saveSong(song);
                allSongs.push(song);

                if (!albums[albumName]) albums[albumName] = [];
                albums[albumName].push(song);

                renderAlbums();
                renderAllSongs();
            },
            onError: (err) => console.error("Error reading file:", file.name, err)
        });
    });
});


function renderAlbums() {
    albumRow.innerHTML = "";
    Object.keys(albums).forEach(albumName => {
        const songs = albums[albumName];
        const card = document.createElement("div");
        card.className = "album-card";
        card.innerHTML = `
            <img src="${songs[0].imageUrl}" alt="${albumName}">
            <p>${albumName}</p>
        `;
        card.onclick = () => {
            currentSongs = songs;
            playSong(0);
            document.getElementById("songSectionTitle").textContent = albumName;
        };
        albumRow.appendChild(card);
    });
}

function renderAllSongs(filteredSongs = allSongs) {
    songRow.innerHTML = "";
    filteredSongs.forEach((song, index) => {
        const card = document.createElement("div");
        card.className = "song-card";
        card.innerHTML = `
            <img src="${song.imageUrl}" alt="">
            <div class="song-info-text">
                <h4>${song.title}</h4>
                <p>${song.artist} • ${song.album}</p>
            </div>
        `;
        card.onclick = () => {
            currentSongs = filteredSongs;
            playSong(index);
        };
        songRow.appendChild(card);
    });
}

function updateNowPlayingUI(song) {
    npArt.src = song.imageUrl;
    npTitle.textContent = song.title;
    npArtist.textContent = song.artist;
    document.querySelector(".np-background").style.backgroundImage = `url(${song.imageUrl})`;
}

function playSong(index) {
    if (index < 0 || index >= currentSongs.length) return;

    currentIndex = index;
    const song = currentSongs[index];
    const url = URL.createObjectURL(song.fileData);
    audioPlayer.src = url;

    // Bottom player
    currentTitle.textContent = song.title;
    currentArtist.textContent = song.artist;
    playerArt.src = song.imageUrl;

    // Fullscreen player
    npTitle.textContent = song.title;
    npArtist.textContent = song.artist;
    npArt.src = song.imageUrl;

    // Background blur image
    document.querySelector(".np-background").style.backgroundImage = `url(${song.imageUrl})`;

    fetchLyrics(song);

    audioPlayer.play().catch(err => console.error(err));

    playBtn.textContent = "⏸";
    npPlayBtn.textContent = "⏸";

    recordPlayer.classList.remove("paused-spin");
}


playBtn.addEventListener("click", () => {
    if (audioPlayer.paused) {
        audioPlayer.play();
        playBtn.textContent = "⏸";
    } else {
        audioPlayer.pause();
        playBtn.textContent = "▶";
    }
});

prevBtn.addEventListener("click", () => playSong(currentIndex - 1));
nextBtn.addEventListener("click", () => playSong(currentIndex + 1));

audioPlayer.addEventListener("timeupdate", () => {
    if (audioPlayer.duration) {
        progressBar.value = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
        durationText.textContent = formatTime(audioPlayer.duration);

        npProgress.value = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        npCurrent.textContent = formatTime(audioPlayer.currentTime);
        npDuration.textContent = formatTime(audioPlayer.duration);
    }
    updateLyrics();
});

progressBar.addEventListener("input", () => {
    audioPlayer.currentTime = (progressBar.value / 100) * audioPlayer.duration;
});

volumeSlider.addEventListener("input", () => {
    audioPlayer.volume = parseFloat(volumeSlider.value);
});

audioPlayer.addEventListener("ended", () => {
    playSong(currentIndex + 1);
});

searchInput.addEventListener("input", () => {
    const term = searchInput.value.toLowerCase().trim();
    if (term === "") {
        renderAllSongs(allSongs);
        return;
    }
    const filtered = allSongs.filter(song =>
        song.title.toLowerCase().includes(term) ||
        song.artist.toLowerCase().includes(term) ||
        song.album.toLowerCase().includes(term)
    );
    renderAllSongs(filtered);
});


const sidebar = document.getElementById("sidebar");
const toggleSidebar = document.getElementById("toggleSidebar");

toggleSidebar.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
});


const clearLibraryBtn = document.getElementById("clearLibraryBtn");

clearLibraryBtn.addEventListener("click", () => {
    const transaction = db.transaction("songs", "readwrite");
    const store = transaction.objectStore("songs");
    const request = store.clear();

    request.onsuccess = () => {
        allSongs = [];
        currentSongs = [];

        for (let key in albums) {
            delete albums[key];
        }

        albumRow.innerHTML = "";
        songRow.innerHTML = "";

        currentTitle.textContent = "No song playing";
        currentArtist.textContent = "Select music files to begin";
        playerArt.src = "https://via.placeholder.com/80";

        audioPlayer.pause();
        audioPlayer.src = "";

        alert("Music library cleared!");
    };
});


const nowPlayingScreen = document.getElementById("nowPlayingScreen");
const closeNowPlaying = document.getElementById("closeNowPlaying");

const npArt = document.getElementById("npArt");
const npTitle = document.getElementById("npTitle");
const npArtist = document.getElementById("npArtist");

playerArt.addEventListener("click", () => {
    nowPlayingScreen.classList.remove("hidden");
    npArt.src = playerArt.src;
    npTitle.textContent = currentTitle.textContent;
    npArtist.textContent = currentArtist.textContent;
    document.querySelector(".np-background").style.backgroundImage = `url(${playerArt.src})`;
});

closeNowPlaying.addEventListener("click", () => {
    nowPlayingScreen.classList.add("hidden");
});


const npPlayBtn = document.getElementById("npPlayBtn");
const npPrevBtn = document.getElementById("npPrevBtn");
const npNextBtn = document.getElementById("npNextBtn");
const npProgress = document.getElementById("npProgress");
const npCurrent = document.getElementById("npCurrent");
const npDuration = document.getElementById("npDuration");
const recordPlayer = document.getElementById("recordPlayer");

npPlayBtn.addEventListener("click", () => {
    if (audioPlayer.paused) {
        audioPlayer.play();
        npPlayBtn.textContent = "⏸";
        recordPlayer.classList.remove("paused-spin");
    } else {
        audioPlayer.pause();
        npPlayBtn.textContent = "▶";
        recordPlayer.classList.add("paused-spin");
    }
});

npPrevBtn.addEventListener("click", () => playSong(currentIndex - 1));
npNextBtn.addEventListener("click", () => playSong(currentIndex + 1));

npProgress.addEventListener("input", () => {
    audioPlayer.currentTime = (npProgress.value / 100) * audioPlayer.duration;
});

audioPlayer.addEventListener("play", () => {
    npPlayBtn.textContent = "⏸";
    recordPlayer.classList.remove("paused-spin");
});

audioPlayer.addEventListener("pause", () => {
    npPlayBtn.textContent = "▶";
    recordPlayer.classList.add("paused-spin");
});



async function fetchLyrics(song) {
    const lyricsText = document.getElementById("lyricsText");
    if (!lyricsText) return;
    lyricsText.textContent = "Loading lyrics...";

    const track = encodeURIComponent(song.title);
    const artist = encodeURIComponent(song.artist);
    const lrclibUrl = `https://lrclib.net/api/search?track_name=${track}&artist_name=${artist}`;

    const attempts = [
        { url: lrclibUrl, wrapped: false },
        { url: `https://corsproxy.io/?url=${encodeURIComponent(lrclibUrl)}`, wrapped: false },
        { url: `https://api.allorigins.win/get?url=${encodeURIComponent(lrclibUrl)}`, wrapped: true }
    ];

    for (let i = 0; i < attempts.length; i++) {
        try {
            const response = await fetch(attempts[i].url);
            if (!response.ok) continue;

            let data = await response.json();
            if (attempts[i].wrapped) data = JSON.parse(data.contents);

            if (data.length > 0) {
                const lyrics = data[0].plainLyrics || data[0].syncedLyrics?.replace(/\[\d+:\d+\.\d+\]/g, "").trim();
                lyricsText.textContent = lyrics || "No lyrics available.";
            } else {
                lyricsText.textContent = "Lyrics not found.";
            }
            return;

        } catch (error) {
            console.warn(`Attempt ${i + 1} failed:`, error);
        }
    }

    lyricsText.textContent = "Failed to load lyrics.";
}
initDB();
