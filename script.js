const segments = [];
let player;
let currentSegmentIndex = 0;
let isPlaying = false;

// You'll need to replace this with your Spotify Client ID
const CLIENT_ID = '41839bbf564c4eb99edfe3aaaee545bb';

// Add these constants at the top
const REDIRECT_URI = 'https://ttarigh.github.io/infinite-podcast/'; // Note the trailing slash
const SCOPES = 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state app-remote-control';

// Add these new constants
const MIN_SEGMENT_LENGTH = 3; // seconds
const MAX_SEGMENT_LENGTH = 15; // seconds
const PODCAST_ID = '2DZwvzn6Z3xCFZrwZGDrbj';

// Add these variables to store podcast data
let podcastEpisodes = [];

function addSegment() {
    const url = document.getElementById('episode-url').value;
    const startTime = document.getElementById('start-time').value;
    const endTime = document.getElementById('end-time').value;

    // Extract episode URI from URL
    const episodeId = url.split('/').pop().split('?')[0];
    const episodeUri = `spotify:episode:${episodeId}`;
    
    const segment = {
        episodeUri,
        startTime: parseInt(startTime) * 1000, // Convert to milliseconds
        endTime: parseInt(endTime) * 1000,
        title: `Segment ${segments.length + 1}`
    };

    segments.push(segment);
    displaySegments();
    
    // Clear inputs
    document.getElementById('episode-url').value = '';
    document.getElementById('start-time').value = '';
    document.getElementById('end-time').value = '';
}

// Add login function
function login() {
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}`;
    window.location.href = authUrl;
}

// Add function to get access token from URL
function getAccessTokenFromUrl() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    return params.get('access_token');
}

// Modify the initialization code
window.onload = () => {
    const accessToken = getAccessTokenFromUrl();
    
    if (accessToken) {
        // Hide login button and show player if we have a token
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('player-container').style.display = 'block';
        
        // Store token for the SDK to use
        window.accessToken = accessToken;
        
        // Fetch episodes after getting access token
        fetchPodcastEpisodes();
    }
};

window.onSpotifyWebPlaybackSDKReady = () => {
    console.log('Spotify SDK Ready');
    player = new Spotify.Player({
        name: 'Podcast Splice Player',
        getOAuthToken: callback => {
            console.log('Getting OAuth token');
            callback(window.accessToken);
        }
    });

    player.connect().then(success => {
        console.log('Player connected:', success);
    });

    player.addListener('ready', ({ device_id }) => {
        console.log('Player ready with Device ID:', device_id);
        transferPlayback(device_id);
    });

    player.addListener('not_ready', ({ device_id }) => {
        console.log('Device ID has gone offline:', device_id);
    });

    player.addListener('player_state_changed', state => {
        console.log('Player state changed:', state);
        if (state) {
            const currentTime = state.position;
            const currentSegment = segments[currentSegmentIndex];
            console.log(`Current time: ${currentTime}, Segment end: ${currentSegment.endTime}`);
            
            updateNowPlaying(currentSegment);
            
            if (currentTime >= currentSegment.endTime) {
                console.log('Segment ended, playing next');
                playNextSegment();
            }
        }
    });

    player.addListener('initialization_error', ({ message }) => {
        console.error('Failed to initialize:', message);
    });

    player.addListener('authentication_error', ({ message }) => {
        console.error('Failed to authenticate:', message);
    });

    player.addListener('account_error', ({ message }) => {
        console.error('Failed to validate Spotify account:', message);
    });

    player.addListener('playback_error', ({ message }) => {
        console.error('Failed to perform playback:', message);
    });

    document.getElementById('play-pause').addEventListener('click', togglePlay);
};

function updateNowPlaying(segment) {
    const nowPlaying = document.getElementById('now-playing');
    nowPlaying.textContent = `Now Playing: ${segment.title} (${segment.startTime/1000}s - ${segment.endTime/1000}s)`;
}

async function playSegment(index) {
    console.log(`Attempting to play segment ${index}:`, segments[index]);
    currentSegmentIndex = index;
    const segment = segments[index];
    
    try {
        // Start playback of the episode
        await fetch('https://api.spotify.com/v1/me/player/play', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${window.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                uris: [segment.episodeUri],
                position_ms: segment.startTime
            })
        });
        
        console.log('Playback started');
        isPlaying = true;
        document.getElementById('play-pause').textContent = 'Pause';
        updateNowPlaying(segment);
    } catch (error) {
        console.error('Error starting playback:', error);
    }
}

function playNextSegment() {
    if (currentSegmentIndex < segments.length - 1) {
        playSegment(currentSegmentIndex + 1);
    } else {
        // Generate and add new segment
        generateNewSegment().then(() => {
            playSegment(currentSegmentIndex + 1);
        });
    }
}

function togglePlay() {
    console.log('Toggle play clicked. Current state:', { isPlaying, segmentsCount: segments.length });
    if (isPlaying) {
        console.log('Pausing playback');
        player.pause();
        isPlaying = false;
        document.getElementById('play-pause').textContent = 'Play';
    } else {
        if (segments.length === 0) {
            console.log('No segments, generating initial segments');
            generateInitialSegments().then(() => {
                console.log('Initial segments generated, playing first segment');
                playSegment(0);
            });
        } else if (currentSegmentIndex === 0) {
            console.log('Playing first segment');
            playSegment(0);
        } else {
            console.log('Resuming playback');
            player.resume();
            isPlaying = true;
            document.getElementById('play-pause').textContent = 'Pause';
        }
    }
}

function displaySegments() {
    const list = document.getElementById('segments-list');
    list.innerHTML = '';
    
    segments.forEach((segment, index) => {
        const div = document.createElement('div');
        div.className = 'segment-item';
        const duration = (segment.endTime - segment.startTime) / 1000;
        div.innerHTML = `
            ${segment.title}<br>
            Duration: ${duration}s (${segment.startTime/1000}s - ${segment.endTime/1000}s)
        `;
        list.appendChild(div);
    });
}

// Add event listener for login button
document.getElementById('login-button').addEventListener('click', login); 

// Add this function to generate random segment length
function getRandomSegmentLength() {
    return Math.floor(Math.random() * (MAX_SEGMENT_LENGTH - MIN_SEGMENT_LENGTH + 1) + MIN_SEGMENT_LENGTH);
}

// Add function to fetch podcast episodes
async function fetchPodcastEpisodes() {
    try {
        const response = await fetch(`https://api.spotify.com/v1/shows/${PODCAST_ID}/episodes?limit=50`, {
            headers: {
                'Authorization': `Bearer ${window.accessToken}`
            }
        });
        const data = await response.json();
        podcastEpisodes = data.items;
        console.log('Fetched episodes:', podcastEpisodes);
        
        // Generate initial segments once we have episodes
        await generateInitialSegments();
    } catch (error) {
        console.error('Error fetching episodes:', error);
    }
}

// Add function to generate initial segments
async function generateInitialSegments() {
    // Generate 5 initial segments
    for (let i = 0; i < 5; i++) {
        await generateNewSegment();
    }
}

// Update generateNewSegment function
async function generateNewSegment() {
    if (!podcastEpisodes.length) return;

    const length = getRandomSegmentLength();
    const episode = podcastEpisodes[Math.floor(Math.random() * podcastEpisodes.length)];
    
    // Convert duration from ms to seconds
    const episodeDuration = Math.floor(episode.duration_ms / 1000);
    // Generate random start time (leaving room for segment length)
    const maxStartTime = episodeDuration - length;
    const startTimeInSeconds = Math.floor(Math.random() * maxStartTime);
    
    const segment = {
        episodeUri: `spotify:episode:${episode.id}`,
        startTime: startTimeInSeconds * 1000,
        endTime: (startTimeInSeconds + length) * 1000,
        title: `${episode.name} (${startTimeInSeconds}s)`
    };
    
    segments.push(segment);
    displaySegments();
}

// Add this new function
async function transferPlayback(deviceId) {
    console.log('Transferring playback to web player');
    try {
        await fetch('https://api.spotify.com/v1/me/player', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${window.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                device_ids: [deviceId],
                play: false,
            }),
        });
        console.log('Playback transferred successfully');
    } catch (error) {
        console.error('Error transferring playback:', error);
    }
} 