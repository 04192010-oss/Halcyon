// ============================================================
//  Halcyon — Music Player
//  index.js
//
//  Handles everything: file loading, IndexedDB persistence,
//  playback controls, search/sort, lyrics fetching, and the
//  Now Playing overlay.
// ============================================================


// ============================================================
//  DOM REFERENCES
//  Grab all the elements we'll be touching throughout the app.
// ============================================================

const sidebar        = document.getElementById("sidebar");
const toggleSidebar  = document.getElementById("toggleSidebar");

const fileInput  = document.getElementById("fileInput");
const albumRow   = document.getElementById("albumRow");
const songRow    = document.getElementById("songRow");
const searchInput = document.getElementById("searchInput");

const audioPlayer = document.getElementById("audioPlayer");

// Bottom-bar player controls
const playBtn = document.getElementById("PlayBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

// Bottom-bar display
const currentTitle  = document.getElementById("currentTitle");
const currentArtist = document.getElementById("currentArtist");
const playerArt     = document.getElementById("playerArt");

// Bottom-bar seek bar
const progressBar   = document.getElementById("progressBar");
const currentTimeEl = document.getElementById("currentTime");
const durationText  = document.getElementById("duration");

const volumeSlider = document.getElementById("volumeSlider");

// Now Playing overlay
const nowPlayingScreen = document.getElementById("nowPlayingScreen");
const closeNowPlaying  = document.getElementById("closeNowPlaying");

// Now Playing display
const npArt    = document.getElementById("npArt");
const npTitle  = document.getElementById("npTitle");
const npArtist = document.getElementById("npArtist");

// Now Playing controls
const npPlayBtn = document.getElementById("npPlayBtn");
const npPrevBtn = document.getElementById("npPrevBtn");
const npNextBtn = document.getElementById("npNextBtn");

// Now Playing seek bar
const npProgress = document.getElementById("npProgress");
const npCurrent  = document.getElementById("npCurrent");
const npDuration = document.getElementById("npDuration");

// Spinning vinyl record in the Now Playing overlay
const recordPlayer = document.getElementById("recordPlayer");

// Sidebar action buttons
const clearLibraryBtn  = document.getElementById("clearLibraryBtn");
const infiniteRadioBtn = document.getElementById("infiniteRadioBtn");
const sortSelect       = document.getElementById("sortSelect");


// ============================================================
//  APP STATE
// ============================================================

let db; // IndexedDB instance, set once the DB opens

const DB_NAME    = "HalcyonMusic";
const DB_VERSION = 1;

// albums is a plain object keyed by album name, e.g. { "Abbey Road": [song, song, ...] }
const albums = {};

let allSongs     = []; // every song in the library
let currentSongs = []; // the active playlist (all songs, an album, or a radio shuffle)

let currentIndex   = 0;
let currentSort    = "title";
let isInfiniteRadio = false;


// ============================================================
//  SIDEBAR — collapse / expand
// ============================================================

toggleSidebar.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
});


// ============================================================
//  INDEXEDDB — persistent storage for song files and metadata
// ============================================================

function initDB() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // Runs only when the DB is first created or its version changes.
    // Creates the "songs" object store if it doesn't exist yet.
    request.onupgradeneeded = (event) => {
        db = event.target.result;
        if (!db.objectStoreNames.contains("songs")) {
            db.createObjectStore("songs", { keyPath: "id", autoIncrement: true });
        }
    };

    // DB opened successfully — load whatever was saved from last time.
    request.onsuccess = (event) => {
        db = event.target.result;
        loadSavedSongs();
    };

    request.onerror = () => {
        console.error("IndexedDB failed to open. Songs won't persist between sessions.");
    };
}

// Save a single song object to IndexedDB.
function saveSong(song) {
    const transaction = db.transaction("songs", "readwrite");
    const store = transaction.objectStore("songs");
    store.add(song);
}

// Pull all saved songs out of IndexedDB and rebuild the UI.
function loadSavedSongs() {
    const transaction = db.transaction("songs", "readonly");
    const store = transaction.objectStore("songs");
    const request = store.getAll();

    request.onsuccess = () => {
        allSongs = request.result || [];

        // Clear the albums map before rebuilding it.
        for (let key in albums) {
            delete albums[key];
        }

        // Restore object URLs for album art (ImageBlob → temporary URL).
        allSongs.forEach(song => {
            song.imageUrl = song.imageBlob
                ? URL.createObjectURL(song.imageBlob)
                : "https://via.placeholder.com/300x300/2a2a44/ffffff?text=No+Cover";

            // Group each song under its album name.
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


// ============================================================
//  HELPERS
// ============================================================

// Convert a raw seconds value into "m:ss" format for display.
function formatTime(seconds) {
    if (isNaN(seconds) || seconds === Infinity) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Return a sorted copy of a song array without mutating the original.
function sortSongs(songs, criteria) {
    return [...songs].sort((a, b) => {
        let valA, valB;

        switch (criteria) {
            case "artist":
                valA = a.artist.toLowerCase();
                valB = b.artist.toLowerCase();
                break;
            case "album":
                valA = a.album.toLowerCase();
                valB = b.album.toLowerCase();
                break;
            case "title":
            default:
                valA = a.title.toLowerCase();
                valB = b.title.toLowerCase();
        }

        return valA.localeCompare(valB);
    });
}


// ============================================================
//  FILE INPUT — read audio files and extract their metadata
// ============================================================

fileInput.addEventListener("change", (event) => {
    const files = Array.from(event.target.files).filter(f => f.type.startsWith("audio/"));

    files.forEach(file => {
        // jsmediatags reads ID3 tags embedded in the audio file.
        jsmediatags.read(file, {
            onSuccess: (tag) => {
                const title     = tag.tags.title   || file.name.replace(/\.[^/.]+$/, "");
                const artist    = tag.tags.artist  || "Unknown Artist";
                const albumName = tag.tags.album   || "Unknown Album";
                const picture   = tag.tags.picture;

                // Convert the embedded cover art bytes into a usable image URL.
                let imageBlob = null;
                let imageUrl  = "https://via.placeholder.com/300x300/2a2a44/ffffff?text=No+Cover";

                if (picture) {
                    imageBlob = new Blob([new Uint8Array(picture.data)], { type: picture.format });
                    imageUrl  = URL.createObjectURL(imageBlob);
                }

                const song = {
                    title,
                    artist,
                    album: albumName,
                    fileName: file.name,
                    fileType: file.type,
                    fileData: file,   // the raw File object — needed to create a playback URL
                    imageBlob,
                    imageUrl,
                };

                saveSong(song);
                allSongs.push(song);

                if (!albums[albumName]) {
                    albums[albumName] = [];
                }
                albums[albumName].push(song);

                renderAlbums();
                renderAllSongs();
            },

            onError: (err) => {
                console.error(`Couldn't read tags for "${file.name}":`, err);
            }
        });
    });
});


// ============================================================
//  RENDER — Albums
// ============================================================

function renderAlbums() {
    albumRow.innerHTML = "";

    Object.keys(albums).forEach(albumName => {
        const songs = albums[albumName];

        const card = document.createElement("div");
        card.className = "album-card";

        // Use the first song's cover art to represent the whole album.
        card.innerHTML = `
            <img src="${songs[0].imageUrl}" alt="${albumName}">
            <p>${albumName}</p>
        `;

        // Clicking an album card scopes the playlist to just that album.
        card.onclick = () => {
            currentSongs = songs;
            playSong(0);
            document.getElementById("songSectionTitle").textContent = albumName;
        };

        albumRow.appendChild(card);
    });
}


// ============================================================
//  RENDER — Song List
// ============================================================

function renderAllSongs(filteredSongs = allSongs) {
    songRow.innerHTML = "";

    const sortedSongs = sortSongs(filteredSongs, currentSort);

    sortedSongs.forEach((song, index) => {
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
            // Playing a song from the list sets the playlist to the current sorted view.
            currentSongs = sortedSongs;
            playSong(index);
        };

        songRow.appendChild(card);
    });
}


// ============================================================
//  PLAYBACK — load and play a song by its index in currentSongs
// ============================================================

function playSong(index) {
    if (index < 0 || index >= currentSongs.length) return;

    currentIndex = index;
    const song = currentSongs[index];

    // Each time we play, create a fresh object URL for the file.
    audioPlayer.src = URL.createObjectURL(song.fileData);

    // Update the bottom player bar.
    currentTitle.textContent  = song.title;
    currentArtist.textContent = song.artist;
    playerArt.src             = song.imageUrl;

    // Update the Now Playing overlay.
    npTitle.textContent  = song.title;
    npArtist.textContent = song.artist;
    npArt.src            = song.imageUrl;

    // Set the blurred background in the Now Playing overlay.
    document.querySelector(".np-background").style.backgroundImage = `url(${song.imageUrl})`;

    // Kick off a lyrics fetch in the background.
    fetchLyrics(song);

    audioPlayer.play().catch(err => console.error("Playback error:", err));

    // Update play button icons and resume the vinyl spin.
    playBtn.innerHTML    = '<i class="fi fi-sr-pause"></i>';
    npPlayBtn.innerHTML  = '<i class="fi fi-sr-pause"></i>';
    recordPlayer.classList.remove("paused-spin");
}


// ============================================================
//  PLAYER CONTROLS — play/pause, prev, next
// ============================================================

playBtn.addEventListener("click", () => {
    audioPlayer.paused ? audioPlayer.play() : audioPlayer.pause();
});

npPlayBtn.addEventListener("click", () => {
    audioPlayer.paused ? audioPlayer.play() : audioPlayer.pause();
});

// Sync both play buttons and the vinyl animation whenever playback state changes.
audioPlayer.addEventListener("play", () => {
    playBtn.innerHTML   = '<i class="fi fi-sr-pause"></i>';
    npPlayBtn.innerHTML = '<i class="fi fi-sr-pause"></i>';
    recordPlayer.classList.remove("paused-spin");
});

audioPlayer.addEventListener("pause", () => {
    playBtn.innerHTML   = '<i class="fi fi-sr-play"></i>';
    npPlayBtn.innerHTML = '<i class="fi fi-sr-play"></i>';
    recordPlayer.classList.add("paused-spin");
});

prevBtn.addEventListener("click",   () => playSong(currentIndex - 1));
nextBtn.addEventListener("click",   () => playSong(currentIndex + 1));
npPrevBtn.addEventListener("click", () => playSong(currentIndex - 1));
npNextBtn.addEventListener("click", () => playSong(currentIndex + 1));


// ============================================================
//  SEEK BAR — update as the song plays, and handle scrubbing
// ============================================================

audioPlayer.addEventListener("timeupdate", () => {
    if (!audioPlayer.duration) return;

    const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;

    // Keep both seek bars (bottom bar + Now Playing) in sync.
    progressBar.value = progress;
    npProgress.value  = progress;

    const elapsed  = formatTime(audioPlayer.currentTime);
    const total    = formatTime(audioPlayer.duration);

    currentTimeEl.textContent = elapsed;
    npCurrent.textContent     = elapsed;

    durationText.textContent = total;
    npDuration.textContent   = total;
});

// Scrub when the user drags the bottom-bar seek bar.
progressBar.addEventListener("input", () => {
    audioPlayer.currentTime = (progressBar.value / 100) * audioPlayer.duration;
});

// Scrub when the user drags the Now Playing seek bar.
npProgress.addEventListener("input", () => {
    audioPlayer.currentTime = (npProgress.value / 100) * audioPlayer.duration;
});


// ============================================================
//  VOLUME
// ============================================================

volumeSlider.addEventListener("input", () => {
    audioPlayer.volume = parseFloat(volumeSlider.value);
});


// ============================================================
//  SEARCH — real-time filtering across title, artist, and album
// ============================================================

searchInput.addEventListener("input", () => {
    const term = searchInput.value.toLowerCase().trim();

    if (term === "") {
        renderAllSongs(allSongs);
        return;
    }

    const filtered = allSongs.filter(song =>
        song.title.toLowerCase().includes(term)  ||
        song.artist.toLowerCase().includes(term) ||
        song.album.toLowerCase().includes(term)
    );

    renderAllSongs(filtered);
});


// ============================================================
//  SORT — re-render the song list when the dropdown changes
// ============================================================

sortSelect.addEventListener("change", (e) => {
    currentSort = e.target.value;
    renderAllSongs(allSongs);
});


// ============================================================
//  CLEAR LIBRARY — wipe IndexedDB and reset the UI to empty
// ============================================================

clearLibraryBtn.addEventListener("click", () => {
    const transaction = db.transaction("songs", "readwrite");
    const store = transaction.objectStore("songs");
    const request = store.clear();

    request.onsuccess = () => {
        // Reset all state.
        allSongs     = [];
        currentSongs = [];
        for (let key in albums) delete albums[key];

        // Clear the UI.
        albumRow.innerHTML = "";
        songRow.innerHTML  = "";

        // Reset the player bar to its default empty state.
        currentTitle.textContent  = "No song playing";
        currentArtist.textContent = "Select music files to begin";
        playerArt.src = "https://via.placeholder.com/80";

        audioPlayer.pause();
        audioPlayer.src = "";

        alert("Music library cleared!");
    };
});


// ============================================================
//  NOW PLAYING SCREEN — open and close the full-screen overlay
// ============================================================

// Clicking the album art in the player bar opens the overlay.
playerArt.addEventListener("click", () => {
    nowPlayingScreen.classList.remove("hidden");

    // Mirror whatever's currently showing in the player bar.
    npArt.src            = playerArt.src;
    npTitle.textContent  = currentTitle.textContent;
    npArtist.textContent = currentArtist.textContent;

    document.querySelector(".np-background").style.backgroundImage = `url(${playerArt.src})`;
});

closeNowPlaying.addEventListener("click", () => {
    nowPlayingScreen.classList.add("hidden");
});


// ============================================================
//  INFINITE RADIO — shuffles the whole library and plays randomly
// ============================================================

infiniteRadioBtn.addEventListener("click", () => {
    if (allSongs.length === 0) {
        alert("Add some songs first!");
        return;
    }

    isInfiniteRadio = true;
    infiniteRadioBtn.classList.add("active");

    // Shuffle a copy of the library (Fisher-Yates via Math.random).
    currentSongs = [...allSongs].sort(() => Math.random() - 0.5);

    const randomIndex = Math.floor(Math.random() * currentSongs.length);
    playSong(randomIndex);

    document.getElementById("songSectionTitle").textContent = "Infinite Radio";
});


// ============================================================
//  SONG END — what to do when a track finishes
// ============================================================

audioPlayer.addEventListener("ended", () => {
    if (isInfiniteRadio && currentSongs.length > 1) {
        // In radio mode, pick a random next track (never the same one twice in a row).
        let nextIndex;
        do {
            nextIndex = Math.floor(Math.random() * currentSongs.length);
        } while (nextIndex === currentIndex);

        playSong(nextIndex);
    } else {
        // Normal mode: just advance to the next track in the list.
        playSong(currentIndex + 1);
    }
});


// ============================================================
//  LYRICS — fetch from lrclib.net with fallback CORS proxies
// ============================================================

async function fetchLyrics(song) {
    const lyricsText = document.getElementById("lyricsText");
    if (!lyricsText) return;

    lyricsText.textContent = "Loading lyrics...";

    const track  = encodeURIComponent(song.title);
    const artist = encodeURIComponent(song.artist);

    // The target API endpoint.
    const lrclibUrl = `https://lrclib.net/api/search?track_name=${track}&artist_name=${artist}`;

    // We try the API directly first, then fall back to two CORS proxies
    // in case the browser blocks the direct request.
    const attempts = [
        { url: lrclibUrl,                                                                    wrapped: false },
        { url: `https://corsproxy.io/?url=${encodeURIComponent(lrclibUrl)}`,                wrapped: false },
        { url: `https://api.allorigins.win/get?url=${encodeURIComponent(lrclibUrl)}`,       wrapped: true  },
    ];

    for (let i = 0; i < attempts.length; i++) {
        try {
            const response = await fetch(attempts[i].url);
            if (!response.ok) continue;

            let data = await response.json();

            // allorigins wraps the real JSON inside a "contents" string.
            if (attempts[i].wrapped) {
                data = JSON.parse(data.contents);
            }

            if (data.length > 0) {
                // Prefer plain lyrics; fall back to stripping timestamps from synced lyrics.
                const lyrics =
                    data[0].plainLyrics ||
                    data[0].syncedLyrics?.replace(/\[\d+:\d+\.\d+\]/g, "").trim();

                lyricsText.textContent = lyrics || "No lyrics available.";
            } else {
                lyricsText.textContent = "Lyrics not found.";
            }

            return; // Stop after the first successful attempt.

        } catch (error) {
            console.warn(`Lyrics fetch attempt ${i + 1} failed:`, error);
        }
    }

    // All three attempts failed.
    lyricsText.textContent = "Failed to load lyrics.";
}


// ============================================================
//  INIT — open IndexedDB to kick everything off
// ============================================================

initDB();
