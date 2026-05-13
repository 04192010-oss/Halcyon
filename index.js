const fileInput = document.getElementById("fileInput");
const albumRow = document.getElementById("albumRow");
const songRow = document.getElementById("songRow");

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

const albums = {};
let allSongs = [];
let currentSongs = [];
let currentIndex = 0;

// Format time
function formatTime(seconds) {
    if (isNaN(seconds) || seconds === Infinity) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

fileInput.addEventListener("change", (event) => {
    const files = event.target.files;
    
    // Reset
    Object.keys(albums).forEach(key => delete albums[key]);
    allSongs = [];
    albumRow.innerHTML = "";
    songRow.innerHTML = "";

    let processed = 0;
    const audioFiles = Array.from(files).filter(f => f.type.startsWith("audio/"));

    if (audioFiles.length === 0) return;

    audioFiles.forEach(file => {
        jsmediatags.read(file, {
            onSuccess: (tag) => {
                const title = tag.tags.title || file.name.replace(/\.[^/.]+$/, "");
                const artist = tag.tags.artist || "Unknown Artist";
                const albumName = tag.tags.album || "Unknown Album";
                const picture = tag.tags.picture;

                let imageUrl = "https://via.placeholder.com/300x300/2a2a44/ffffff?text=No+Cover";
                if (picture) {
                    const blob = new Blob([new Uint8Array(picture.data)], { type: picture.format });
                    imageUrl = URL.createObjectURL(blob);
                }

                const song = { title, artist, album: albumName, file, imageUrl };

                if (!albums[albumName]) albums[albumName] = [];
                albums[albumName].push(song);
                allSongs.push(song);

                processed++;

                if (processed === audioFiles.length) {
                    renderAlbums();
                    renderAllSongs();
                    currentSongs = allSongs;
                    playSong(0);
                }
            },
            onError: (err) => {
                console.error("Error reading tags for:", file.name, err);
                processed++;
            }
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

function renderAllSongs() {
    songRow.innerHTML = "";
    allSongs.forEach((song, index) => {
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
            currentSongs = allSongs;
            playSong(index);
        };
        songRow.appendChild(card);
    });
}

function playSong(index) {
    if (index < 0 || index >= currentSongs.length) return;

    currentIndex = index;
    const song = currentSongs[index];

    const url = URL.createObjectURL(song.file);
    audioPlayer.src = url;

    currentTitle.textContent = song.title;
    currentArtist.textContent = song.artist;
    playerArt.src = song.imageUrl;

    audioPlayer.play().catch(err => {
        console.error(err);
        if (song.file.name.toLowerCase().endsWith('.flac')) {
            alert("FLAC file could not play.\n\nTry using Google Chrome or convert to MP3.");
        }
    });

    playBtn.textContent = "⏸";
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
    }
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
