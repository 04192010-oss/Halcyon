<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Halcyon</title>

    <link rel="icon" type="image/png" href="images/halcyon.webp">
    <link rel="stylesheet" href="styles.css">

    <!-- Icon libraries from Flaticon -->
    <link rel="stylesheet" href="https://cdn-uicons.flaticon.com/2.6.0/uicons-solid-rounded/css/uicons-solid-rounded.css">
    <link rel="stylesheet" href="https://cdn-uicons.flaticon.com/2.6.0/uicons-regular-rounded/css/uicons-regular-rounded.css">
</head>

<body>

<div class="container">

    <!-- =====================
         SIDEBAR
         Left navigation panel with page links and library controls.
    ===================== -->
    <aside class="sidebar" id="sidebar">

        <div class="sidebar-header">
            <h2>Halcyon</h2>
            <!-- Collapse/expand the sidebar -->
            <button id="toggleSidebar" class="toggle-btn">
                <i class="fi fi-sr-menu-burger"></i>
            </button>
        </div>

        <!-- Navigation links (currently cosmetic — no routing yet) -->
        <ul>
            <li>
                <i class="fi fi-sr-home"></i>
                <span>Home</span>
            </li>
            <li>
                <i class="fi fi-sr-time-forward"></i>
                <span>Recent</span>
            </li>
            <li>
                <i class="fi fi-sr-book"></i>
                <span>Library</span>
            </li>
            <li>
                <i class="fi fi-sr-settings"></i>
                <span>Settings</span>
            </li>
        </ul>

        <!-- Library action buttons at the bottom of the sidebar -->
        <div class="sidebar-actions">

            <!-- Clicking this label triggers the hidden file input below -->
            <label for="fileInput" class="sidebar-add-btn">
                <i class="fi fi-sr-music-alt"></i>
                <span>Add Music</span>
            </label>

            <button id="clearLibraryBtn" class="sidebar-clear-btn">
                <i class="fi fi-rr-trash"></i>
                <span>Clear Library</span>
            </button>

        </div>

    </aside>

    <!-- =====================
         MAIN CONTENT
         Holds the search bar, album grid, and song list.
    ===================== -->
    <main class="main-content">

        <!-- Hidden file input — triggered by the "Add Music" label in the sidebar -->
        <div class="file-picker">
            <input type="file" id="fileInput" multiple accept="audio/*" style="display:none;">
        </div>

        <!-- Search bar — filters songs by title, artist, or album in real time -->
        <div class="search-bar">
            <input type="text" id="searchInput" placeholder="Search songs...">
        </div>

        <!-- Album cards, auto-generated from loaded songs -->
        <section class="albums">
            <h2>Your Albums</h2>
            <div id="albumRow" class="album-row"></div>
        </section>

        <!-- Song list with sort and Infinite Radio controls -->
        <section class="recommended-songs">

            <div class="section-header">

                <!-- Title changes when filtering by album or enabling Infinite Radio -->
                <h2 id="songSectionTitle">All Songs</h2>

                <div class="sort-container">

                    <!-- Shuffles all songs and plays them in random order -->
                    <button id="infiniteRadioBtn" class="infinite-radio-btn">
                        <i class="fi fi-sr-radio-tower"></i>
                        Infinite Radio
                    </button>

                    <!-- Sort the song list by title, artist, or album -->
                    <select id="sortSelect" class="sort-select">
                        <option value="title">Sort by Title</option>
                        <option value="artist">Sort by Artist</option>
                        <option value="album">Sort by Album</option>
                    </select>

                </div>

            </div>

            <!-- Song cards are injected here by JavaScript -->
            <div id="songRow" class="song-row"></div>

        </section>

    </main>

</div>

<!-- =====================
     FLOATING PLAYER
     Fixed to the bottom of the screen. Shows current track info,
     playback controls, a seek bar, and volume slider.
===================== -->
<footer class="player" id="player">

    <div class="player-content">

        <!-- LEFT: Album art, song name, artist, and like button -->
        <div class="song-info">

            <!-- Clicking the album art opens the full Now Playing screen -->
            <img id="playerArt" src="https://via.placeholder.com/80" alt="Album Art">

            <div class="song-info-text">
                <div id="currentTitle" class="title">No song playing</div>
                <div id="currentArtist" class="artist">Select music files to begin</div>
            </div>

            <!-- Like/favourite button (visual only for now) -->
            <button id="likeBtn" class="player-btn">♡</button>

        </div>

        <!-- CENTER: Play/pause, prev/next, and the seek bar -->
        <div class="player-center">

            <div class="controls">
                <button id="prevBtn" class="player-btn">
                    <i class="fi fi-rr-arrow-small-left"></i>
                </button>
                <button id="PlayBtn" class="play-main-btn">
                    <i class="fi fi-sr-play"></i>
                </button>
                <button id="nextBtn" class="player-btn">
                    <i class="fi fi-rr-arrow-small-right"></i>
                </button>
            </div>

            <div class="progress-area">
                <span id="currentTime">0:00</span>
                <input type="range" id="progressBar" value="0" min="0" max="100">
                <span id="duration">0:00</span>
            </div>

        </div>

        <!-- RIGHT: Shuffle, repeat, and volume -->
        <div class="player-right">
            <button class="player-btn"><i class="fi fi-sr-shuffle"></i></button>
            <button class="player-btn"><i class="fi fi-sr-loop-square"></i></button>

            <div class="volume-control">
                <span><i class="fi fi-sr-volume"></i></span>
                <input type="range" id="volumeSlider" value="1" min="0" max="1" step="0.01">
            </div>
        </div>

    </div>

</footer>

<!-- =====================
     NOW PLAYING SCREEN
     Full-screen overlay with the spinning vinyl record, song controls,
     and a lyrics panel on the right side.
===================== -->
<div id="nowPlayingScreen" class="now-playing hidden">

    <!-- Blurred album art fills the background -->
    <div class="np-background"></div>

    <!-- Close button returns to the main view -->
    <button id="closeNowPlaying" class="close-btn">✕</button>

    <div class="np-content">

        <!-- LEFT: Vinyl record, song info, controls, seek bar -->
        <div class="np-left">

            <div class="vinyl-wrapper">
                <div class="record-player rotating" id="recordPlayer">
                    <div class="vinyl-disc"></div>
                    <img id="npArt" src="" class="np-art">
                    <div class="vinyl-center"></div>
                </div>
            </div>

            <h1 id="npTitle">Song Name</h1>
            <h3 id="npArtist">Artist</h3>

            <div class="np-controls">
                <button id="npPrevBtn" class="glass-btn">
                    <i class="fi fi-rr-arrow-small-left"></i>
                </button>
                <button id="npPlayBtn" class="play-main-btn">
                    <i class="fi fi-sr-play"></i>
                </button>
                <button id="npNextBtn" class="glass-btn">
                    <i class="fi fi-sr-arrow-small-right"></i>
                </button>
            </div>

            <div class="np-progress-wrap">
                <span id="npCurrent">0:00</span>
                <input type="range" id="npProgress" value="0" min="0" max="100">
                <span id="npDuration">0:00</span>
            </div>

        </div>

        <!-- RIGHT: Lyrics fetched from lrclib.net -->
        <div class="lyrics-panel">
            <div class="lyrics">
                <div class="lyrics-container">
                    <div id="lyricsText">Loading lyrics...</div>
                </div>
            </div>
        </div>

    </div>

</div>

<!-- The actual audio element — hidden, controlled entirely by JS -->
<audio id="audioPlayer"></audio>

<!-- jsmediatags reads ID3 tags (title, artist, album, cover art) from audio files -->
<script src="https://cdn.jsdelivr.net/npm/jsmediatags@3.9.7/dist/jsmediatags.min.js"></script>
<script src="index.js"></script>

</body>
</html>
