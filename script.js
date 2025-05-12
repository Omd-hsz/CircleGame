const firebaseConfig = {
  apiKey: "AIzaSyBTb2mGrzP9ht5jWGSiH_DjE7_D4JgL4-c",
  authDomain: "testcirclegame.firebaseapp.com",
  projectId: "testcirclegame",
  storageBucket: "testcirclegame.firebasestorage.app",
  messagingSenderId: "411972407840",
  appId: "1:411972407840:web:b2c75a9ebc071f5ea02245",
  measurementId: "G-8P9RNPLPSN"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- DOM Elements ---
const startButton = document.getElementById('start-button');
const gameArea = document.getElementById('game-area');
const timeLeftDisplay = document.getElementById('time-left');
const scoreDisplay = document.getElementById('score');

// --- Add these with your other DOM Element consts near the top ---
const loginSection = document.getElementById('login-section');
const gameSection = document.getElementById('game-section'); // You might already have this
const leaderboardSection = document.getElementById('leaderboard-section');

const usernameInput = document.getElementById('username');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginButton = document.getElementById('login-btn');
const registerButton = document.getElementById('register-btn');
const logoutButton = document.getElementById('logout-btn');
const authStatus = document.getElementById('auth-status');
const currentPlayerDisplay = document.getElementById('current-player');
const leaderboardList = document.getElementById('leaderboard-list');

// --- Auth Functions ---
function handleRegister() {
    const email = emailInput.value;
    const password = passwordInput.value;
    const username = usernameInput.value.trim();

    if (!username) {
        authStatus.textContent = "Please enter a username for display.";
        return;
    }
    if (!email || !password) {
        authStatus.textContent = "Please enter email and password.";
        return;
    }

    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            return user.updateProfile({ displayName: username }).then(() => { // Chain the updateProfile
                 console.log("User registered and display name set:", user.displayName);
                 authStatus.textContent = `Registered as ${user.displayName || user.email}! Please login.`;
                 emailInput.value = '';
                 passwordInput.value = '';
                 usernameInput.value = ''; // Clear username field too
            });
        })
        .catch((error) => {
            authStatus.textContent = `Error: ${error.message}`;
            console.error("Registration error:", error);
        });
}

function handleLogin() {
    const email = emailInput.value;
    const password = passwordInput.value;

    if (!email || !password) {
        authStatus.textContent = "Please enter email and password.";
        return;
    }

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            authStatus.textContent = ""; // Clear any previous error messages
            // UI update will be handled by onAuthStateChanged
        })
        .catch((error) => {
            authStatus.textContent = `Error: ${error.message}`;
            console.error("Login error:", error);
        });
}

function handleLogout() {
    auth.signOut().then(() => {
        console.log("User logged out");
        // UI update will be handled by onAuthStateChanged
    }).catch((error) => {
        console.error("Logout error:", error);
    });
}

// --- Leaderboard Functions ---
async function saveScore(playerName, playerScore) {
    if (!auth.currentUser) {
        console.log("User not logged in. Score not saved.");
        return;
    }
    const userId = auth.currentUser.uid;
    try {
        await db.collection("scores").add({ // 'db' is already defined from firebase.firestore()
            userId: userId,
            playerName: playerName,
            score: playerScore,
            timestamp: firebase.firestore.FieldValue.serverTimestamp() // Use firebase.firestore here
        });
        console.log("Score saved!");
        loadLeaderboard(); // Refresh leaderboard
    } catch (error) {
        console.error("Error saving score: ", error);
    }
}

async function loadLeaderboard() {
    leaderboardList.innerHTML = '<li>Loading...</li>';
    try {
        const querySnapshot = await db.collection("scores")
                                      .orderBy("score", "desc")
                                      .limit(10)
                                      .get();
        leaderboardList.innerHTML = '';
        if (querySnapshot.empty) {
            leaderboardList.innerHTML = '<li>No scores yet!</li>';
            return;
        }
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const listItem = document.createElement('li');
            listItem.textContent = `${data.playerName || 'Anonymous'}: ${data.score}`;
            leaderboardList.appendChild(listItem);
        });
    } catch (error) {
        console.error("Error loading leaderboard: ", error);
        leaderboardList.innerHTML = '<li>Error loading scores.</li>';
    }
}

// --- Game State Variables ---
let score = 0;
let timeLeft = 60; // Game duration in seconds
let gameTimerId = null; // For the main 60s game timer
let circleTimerId = null; // For the 2s life of each circle
let currentCircle = null;
let isGameRunning = false;

const CIRCLE_DIAMETER = 100;
const CIRCLE_LIFESPAN = 2000; // 2 seconds in milliseconds

// --- Game Logic Functions ---

function getRandomPosition() {
    const gameAreaWidth = gameArea.clientWidth;
    const gameAreaHeight = gameArea.clientHeight;

    // Ensure circle is fully within bounds
    const x = Math.random() * (gameAreaWidth - CIRCLE_DIAMETER);
    const y = Math.random() * (gameAreaHeight - CIRCLE_DIAMETER);
    return { x, y };
}

function createCircle() {
    if (!isGameRunning) return;

    // Remove previous circle if it exists (e.g., if lifespan ended)
    if (currentCircle) {
        currentCircle.remove();
    }

    const circle = document.createElement('div');
    circle.classList.add('circle');
    const position = getRandomPosition();
    circle.style.left = `${position.x}px`;
    circle.style.top = `${position.y}px`;

    circle.addEventListener('click', handleCircleClick);

    gameArea.appendChild(circle);
    currentCircle = circle;

    // Set timer for this circle's lifespan
    clearTimeout(circleTimerId); // Clear any previous circle timer
    circleTimerId = setTimeout(() => {
        if (isGameRunning && currentCircle === circle) { // Check if it's still the active circle
            createCircle(); // Create a new one if this one wasn't clicked
        }
    }, CIRCLE_LIFESPAN);
}

function handleCircleClick(event) {
    if (!isGameRunning || event.target !== currentCircle) return;

    score++;
    scoreDisplay.textContent = score;

    clearTimeout(circleTimerId); // Prevent the old circle's timer from firing
    currentCircle.remove(); // Remove clicked circle immediately
    currentCircle = null;

    createCircle(); // Create a new circle immediately
}

function updateGameTimer() {
    timeLeft--;
    timeLeftDisplay.textContent = timeLeft;

    if (timeLeft <= 0) {
        endGame();
    }
}

function startGame() {
    if (isGameRunning) return;

    isGameRunning = true;
    score = 0;
    timeLeft = 60;
    scoreDisplay.textContent = score;
    timeLeftDisplay.textContent = timeLeft;
    startButton.disabled = true;
    startButton.textContent = "Game in Progress...";

    // Clear any existing game area content
    gameArea.innerHTML = '';
    currentCircle = null; // Reset current circle

    gameTimerId = setInterval(updateGameTimer, 1000);
    createCircle(); // Create the first circle
}

function endGame() {
    isGameRunning = false;
    clearInterval(gameTimerId);
    clearTimeout(circleTimerId);

    if (currentCircle) {
        currentCircle.remove();
        currentCircle = null;
    }

    startButton.disabled = false;
    startButton.textContent = "Start Game";
    alert(`Game Over! Your score: ${score}`);

    // --- ADD THIS PART ---
    // Save score to Firebase
    const currentPlayerName = auth.currentUser ? (auth.currentUser.displayName || auth.currentUser.email) : "Guest";
    if (auth.currentUser) { // Only save if logged in
        saveScore(currentPlayerName, score);
    } else {
        console.log("User not logged in, score not saved to leaderboard.");
        // Optionally, you could still show the leaderboard here for guests if you want
        // loadLeaderboard();
    }
    // --- END OF ADDED PART ---
}


// --- Event Listeners ---
startButton.addEventListener('click', startGame);

// --- Auth State Change Listener ---
auth.onAuthStateChanged((user) => {
    if (user) {
        // User is signed in
        loginSection.style.display = 'none';
        gameSection.style.display = 'block';
        leaderboardSection.style.display = 'block';
        const displayName = user.displayName || user.email; // Use displayName if available
        currentPlayerDisplay.textContent = displayName;
        usernameInput.value = user.displayName || ''; // Pre-fill if they want to update username (though we aren't handling update here)
        emailInput.value = ''; // Clear login form
        passwordInput.value = ''; // Clear login form
        authStatus.textContent = ''; // Clear any auth status messages
        loadLeaderboard(); // Load leaderboard now that user is in
    } else {
        // User is signed out
        loginSection.style.display = 'block';
        gameSection.style.display = 'none';
        leaderboardSection.style.display = 'none';
        currentPlayerDisplay.textContent = "";
        if (isGameRunning) { // If a game was running when user logged out, end it.
            endGame();
        }
    }
});

// --- Event Listeners for Auth (add these) ---
registerButton.addEventListener('click', handleRegister);
loginButton.addEventListener('click', handleLogin);
logoutButton.addEventListener('click', handleLogout);
// startButton.addEventListener('click', startGame); // You should already have this

// --- Initial UI Setup (ensure this is how it is, or add it) ---
// The onAuthStateChanged listener will handle showing the correct view after checking auth state.
// So, we initially hide game/leaderboard and show login.
gameSection.style.display = 'none';
leaderboardSection.style.display = 'none';
loginSection.style.display = 'block';