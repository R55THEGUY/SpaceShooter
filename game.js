// Get the canvas element and its 2D rendering context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// CRUCIAL FOR PIXEL ART RENDERING:
// Disable image smoothing for the 2D context.
// This prevents sprites from looking blurry when scaled up.
ctx.imageSmoothingEnabled = false;
ctx.mozImageSmoothingEnabled = false;
ctx.webkitImageSmoothingEnabled = false;
ctx.msImageSmoothingEnabled = false;

// Load game assets (player, enemy, explosion spritesheets)
const playerImage = new Image();
playerImage.src = 'player.png'; // Make sure player.png is in the same directory

const enemyImage = new Image();
enemyImage.src = 'enemy.png';   // Make sure enemy.png is in the same directory

const explosionImage = new Image();
explosionImage.src = 'explosion.png'; // Make sure explosion.png is in the same directory

// --- Audio Assets ---
const shootSound = new Audio('shoot.mp3'); // Path to your shoot sound
const explosionSound = new Audio('explosion.mp3'); // Path to your explosion sound
const gameOverSound = new Audio('game_over.mp3'); // Path to your game over sound
const tapSound = new Audio('tap.mp3'); // New: Path to your button tap sound

// Set initial volume (0 to 1)
shootSound.volume = 0.3; // Adjust as needed
explosionSound.volume = 0.5; // Adjust as needed
gameOverSound.volume = 0.7; // Adjust game over sound volume
tapSound.volume = 0.2; // New: Adjust tap sound volume (keep it subtle)


// Game states
const GAME_STATE_MENU = 'menu';
const GAME_STATE_PLAYING = 'playing';
const GAME_STATE_GAME_OVER = 'gameOver';
let currentGameState = GAME_STATE_MENU; // Initial game state

// Game state variables
let keys = {}; // Stores the state of pressed keys
let bullets = [];
let enemies = [];
let explosions = [];
let score = 0;
let playerLives = 3; // Player starts with 3 lives
let enemySpawnIntervalId; // To store the interval ID for clearing
let gameLoopId; // To store the requestAnimationFrame ID for cancelling

// Player object - Changed to const to prevent accidental reassignment
const player = {
  x: 0, // Will be centered on initialization
  y: 500,
  width: 8, // Sprite width (source)
  height: 8, // Sprite width (source)
  scale: 4, // Scale factor for rendering (8px * 4 = 32px)
  speed: 3, // Movement speed
  direction: 'idle', // 'left', 'right', or 'idle' for animation
  frame: 1, // Current animation frame for the player (0=left, 1=idle, 2=right)
  frameTick: 0, // Counter for animation frame changes
  isInvincible: false, // Flag for temporary invincibility after being hit
  invincibilityTimer: 0, // Timer for invincibility frames
  maxInvincibilityTime: 90, // Number of update ticks for invincibility
  lastShotTime: 0, // Timestamp of the last shot
  shootCooldown: 150, // Milliseconds between shots for continuous firing
  // Method to create a new bullet
  shoot: function () {
    // Only allow shooting in playing state and if not dead
    if (currentGameState === GAME_STATE_PLAYING) {
        bullets.push({
            x: this.x + (this.width * this.scale) / 2 - 1, // Position bullet in the middle of the player (accounting for scale)
            y: this.y,
            speed: 5
        });
        // Play shoot sound
        shootSound.currentTime = 0; // Rewind to start for quick playback
        shootSound.play().catch(e => console.error("Shoot sound play error:", e));
    }
  }
};

// Declare UI elements globally but assign them in DOMContentLoaded
let mainMenu;
let startButton;
let gameOverScreen;
let finalScoreDisplay;
let restartButton;
let mobileControls; // New reference for mobile controls container
let leftButton, rightButton, shootButton; // New references for mobile buttons
let fullscreenButton; // New reference for fullscreen button

// --- Game State Management ---

// Helper function to toggle visibility of elements
function toggleVisibility(element, show) {
    if (element) {
        if (show) {
            element.classList.remove('hidden');
        } else {
            element.classList.add('hidden');
        }
    }
}

// Shows the main menu screen and hides others
function showMainMenu() {
    currentGameState = GAME_STATE_MENU;
    toggleVisibility(mainMenu, true);
    toggleVisibility(canvas, false);
    toggleVisibility(gameOverScreen, false);
    // Show fullscreen button on mobile menu only
    if (window.matchMedia("(max-width: 768px)").matches) {
        toggleVisibility(fullscreenButton, true);
    }
    toggleVisibility(mobileControls, false); // Hide mobile controls on menu
}

// Starts the game
function startGame() {
    currentGameState = GAME_STATE_PLAYING;
    toggleVisibility(mainMenu, false);
    toggleVisibility(canvas, true);
    toggleVisibility(gameOverScreen, false);
    toggleVisibility(fullscreenButton, false); // Hide fullscreen button once game starts
    // Show mobile controls if on mobile and game is playing
    if (window.matchMedia("(max-width: 768px)").matches) {
        toggleVisibility(mobileControls, true);
    }
    setupGame(); // Initialize game variables and start loops
}

// Shows the game over screen
function showGameOverScreen() {
    currentGameState = GAME_STATE_GAME_OVER;
    if (finalScoreDisplay) finalScoreDisplay.textContent = score; // Update final score
    toggleVisibility(gameOverScreen, true);
    toggleVisibility(canvas, false);
    toggleVisibility(mainMenu, false);
    toggleVisibility(mobileControls, false); // Hide mobile controls on game over
    // Stop all game activities
    clearInterval(enemySpawnIntervalId);
    cancelAnimationFrame(gameLoopId);

    // Play game over sound
    gameOverSound.currentTime = 0; // Rewind to start
    gameOverSound.play().catch(e => console.error("Game Over sound play error:", e));
}

// --- Game Setup and Reset ---
function setupGame() {
  // Reset game variables
  player.x = (canvas.width / 2) - (player.width * player.scale / 2);
  player.y = 500;
  playerLives = 3; // Reset player lives here
  player.isInvincible = false;
  player.invincibilityTimer = 0;
  score = 0;
  bullets = [];
  enemies = [];
  explosions = [];
  player.lastShotTime = 0; // Reset shot timer

  // Clear any existing intervals and animation frames to prevent duplicates
  clearInterval(enemySpawnIntervalId);
  cancelAnimationFrame(gameLoopId);

  // Start spawning enemies
  enemySpawnIntervalId = setInterval(spawnEnemy, 1000); // Spawn an enemy every second

  // Start the game loop
  gameLoop();
}

// --- Event Listeners for Controls ---

// Keyboard controls (desktop) for player movement and shooting
document.addEventListener('keydown', e => {
  keys[e.key] = true;
  // Prevent default browser behavior for spacebar (e.g., scrolling)
  if (e.key === ' ') {
    e.preventDefault();
  }
});

document.addEventListener('keyup', e => {
  keys[e.key] = false;
});

// New: Function to play tap sound
function playTapSound() {
    tapSound.currentTime = 0; // Rewind to start
    tapSound.play().catch(e => console.error("Tap sound play error:", e));
}

// --- Mobile Touch Controls ---
function setupMobileControls() {
    if (leftButton) {
        leftButton.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent scrolling
            keys['ArrowLeft'] = true;
            playTapSound(); // Play tap sound on press
        });
        leftButton.addEventListener('touchend', () => {
            keys['ArrowLeft'] = false;
        });
    }
    if (rightButton) {
        rightButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            keys['ArrowRight'] = true;
            playTapSound(); // Play tap sound on press
        });
        rightButton.addEventListener('touchend', () => {
            keys['ArrowRight'] = false;
        });
    }
    if (shootButton) {
        // Use touchstart and touchend to simulate continuous press
        shootButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            keys[' '] = true; // Simulate spacebar press
            // Note: Tap sound for shoot button is not ideal as it would conflict
            // with the actual shoot sound. Omitting it here.
            // If you want a *separate* tap sound for the button vs. the weapon,
            // you could add it, but it might get noisy.
            // playTapSound();
        });
        shootButton.addEventListener('touchend', () => {
            keys[' '] = false;
        });
    }
}

// --- Fullscreen Functionality ---
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable fullscreen: ${err.message} (${err.name})`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
    playTapSound(); // Play tap sound on fullscreen button click
}


// --- Game Functions ---

// Spawns a new enemy at a random X position at the top of the canvas
function spawnEnemy() {
  if (currentGameState !== GAME_STATE_PLAYING) return; // Only spawn if game is playing
  enemies.push({
    x: Math.random() * (canvas.width - player.width * player.scale), // Random X position within canvas bounds
    y: 0, // Start at the top
    width: 8, // Sprite width (source)
    height: 8, // Sprite height (source)
    scale: 4, // Scale factor for rendering
    frame: 0, // Current animation frame for the enemy
    frameTick: 0 // Counter for animation frame changes
  });
}

// Updates the game state (player, bullets, enemies, collisions, animations)
function update() {
  if (currentGameState !== GAME_STATE_PLAYING) return; // Only update game logic if playing

  // Player movement
  if (keys['ArrowLeft']) {
    player.x -= player.speed;
    player.direction = 'left';
  } else if (keys['ArrowRight']) {
    player.x += player.speed;
    player.direction = 'right';
  } else {
    player.direction = 'idle';
  }

  // Keep player within canvas bounds
  player.x = Math.max(0, Math.min(canvas.width - player.width * player.scale, player.x));

  // Handle player invincibility
  if (player.isInvincible) {
    player.invincibilityTimer++;
    if (player.invincibilityTimer >= player.maxInvincibilityTime) {
      player.isInvincible = false;
      player.invincibilityTimer = 0;
    }
  }

  // Continuous shooting while spacebar is held down (or mobile shoot button)
  if (keys[' ']) {
    const currentTime = performance.now(); // Get current time for cooldown
    // Defensive check before calling player.shoot()
    if (player && typeof player.shoot === 'function' && currentTime - player.lastShotTime > player.shootCooldown) {
      player.shoot();
      player.lastShotTime = currentTime; // Update last shot time
    }
  }

  // Bullets update
  bullets = bullets.filter(b => b.y > 0); // Filter out bullets that have gone off-screen
  bullets.forEach(b => b.y -= b.speed); // Move bullets upwards

  // Enemies update
  enemies.forEach(e => {
    e.y += 1;
    e.frameTick++;
    if (e.frameTick > 10) {
      e.frame = (e.frame + 1) % 5;
      e.frameTick = 0;
    }
  });
  enemies = enemies.filter(e => e.y < canvas.height); // Filter out enemies that have gone off-screen

  // Collision detection (Bullet-Enemy)
  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    const b = bullets[bi];
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];

      // Check for overlap between bullet and enemy bounding boxes
      if (
        b.x < e.x + e.width * e.scale &&
        b.x + 2 > e.x &&
        b.y < e.y + e.height * e.scale &&
        b.y + 4 > e.y
      ) {
        // Collision detected:
        explosions.push({ x: e.x, y: e.y, frame: 0, tick: 0, scale: 4, width: 8, height: 8 });
        explosionSound.currentTime = 0; // Rewind for quick playback
        explosionSound.play().catch(e => console.error("Explosion sound play error:", e));

        enemies.splice(ei, 1);
        bullets.splice(bi, 1);
        score += 100;
        break;
      }
    }
  }

  // Collision detection (Player-Enemy)
  if (!player.isInvincible) { // Only check for collision if player is not invincible
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];

      // Check for overlap between player and enemy bounding boxes
      if (
        player.x < e.x + e.width * e.scale &&
        player.x + player.width * player.scale > e.x &&
        player.y < e.y + player.height * player.scale &&
        player.y + player.height * player.scale > e.y
      ) {
        console.log("Player-Enemy Collision Detected!"); // Log collision
        console.log("Player Lives BEFORE:", playerLives); // Log lives before decrement
        playerLives--; // Decrease player life
        console.log("Player Lives AFTER:", playerLives); // Log lives after decrement

        explosions.push({ x: player.x, y: player.y, frame: 0, tick: 0, scale: 4, width: 8, height: 8 }); // Explosion at player
        explosionSound.currentTime = 0; // Rewind for quick playback
        explosionSound.play().catch(e => console.error("Player explosion sound play error:", e));

        enemies.splice(ei, 1); // Remove the enemy that hit the player

        if (playerLives <= 0) {
          console.log("Player lives reached 0. Showing Game Over Screen."); // Final lives log
          showGameOverScreen(); // Game over if no lives left
        } else {
          player.isInvincible = true; // Make player invincible for a short time
          player.invincibilityTimer = 0;
          console.log("Player is now invincible."); // Invincibility log
        }
        break; // Player can only be hit by one enemy at a time
      }
    }
  }

  // Explosions update
  explosions = explosions.filter(ex => ex.frame < 3); // Assuming 3 frames for explosion animation
  explosions.forEach(ex => {
    ex.tick++;
    if (ex.tick > 5) {
      ex.frame++;
      ex.tick = 0;
    }
  });

  // Player animation frame update
  player.frameTick++;
  if (player.frameTick > 10) {
    if (player.direction === 'left') player.frame = 0;
    else if (player.direction === 'idle') player.frame = 1;
    else if (player.direction === 'right') player.frame = 2;
    player.frameTick = 0;
  }
}

// Draws all game elements on the canvas
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the entire canvas before drawing new frame

  if (currentGameState === GAME_STATE_PLAYING) {
    // Draw player (with blinking effect if invincible)
    // Blinking effect should only happen IF player is invincible
    if (!player.isInvincible || (player.isInvincible && player.invincibilityTimer % 10 < 5)) {
        ctx.drawImage(
            playerImage,
            player.frame * player.width, 0, player.width, player.height,
            player.x, player.y,
            player.width * player.scale, player.height * player.scale
        );
    }

    // Draw bullets
    ctx.fillStyle = 'red'; // Set bullet color
    bullets.forEach(b => ctx.fillRect(b.x, b.y, 2, 4)); // Draw each bullet as a small rectangle

    // Draw enemies
    enemies.forEach(e => {
      ctx.drawImage(
        enemyImage,
        e.frame * e.width, 0, e.width, e.height,
        e.x, e.y,
        e.width * e.scale, e.height * e.scale
      );
    });

    // Draw explosions
    explosions.forEach(ex => {
      ctx.drawImage(
        explosionImage,
        ex.frame * ex.width, 0, ex.width, ex.height,
        ex.x, ex.y,
        ex.width * ex.scale, ex.height * ex.scale
      );
    });

    // Draw Score and Lives HUD
    ctx.fillStyle = '#00ffff'; // Cyan color for text
    ctx.font = "16px 'Press Start 2P'";
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE: ${score}`, 10, 30);
    ctx.textAlign = 'right';
    ctx.fillText(`LIVES: ${playerLives}`, canvas.width - 10, 30);
  }
}

// The main game loop
function gameLoop() {
  try {
    update(); // Update game logic
    draw();   // Draw current game state
  } catch (error) {
    console.error("Game loop error:", error);
    // If an error occurs, force game over to stop the loop and allow restart
    showGameOverScreen();
    return; // Stop requesting animation frames if an error occurs
  }

  // Continue looping if game is still playing
  if (currentGameState === GAME_STATE_PLAYING) {
    gameLoopId = requestAnimationFrame(gameLoop);
  }
}


// --- Initial Game Start ---
// Ensure all images are loaded before starting the game.
let imagesLoaded = 0;
const totalImages = 3; // playerImage, enemyImage, explosionImage

const imageLoadHandler = () => {
    imagesLoaded++;
    if (imagesLoaded === totalImages) {
        // All images are loaded, show the main menu
        showMainMenu();
    }
};

playerImage.onload = imageLoadHandler;
enemyImage.onload = imageLoadHandler;
explosionImage.onload = imageLoadHandler;

// Handle potential errors if images fail to load
playerImage.onerror = () => console.error("ERROR: Failed to load player.png");
enemyImage.onerror = () => console.error("ERROR: Failed to load enemy.png");
explosionImage.onerror = () => console.error("ERROR: Failed to load explosion.png");

// Ensure DOM is fully loaded before getting elements and attaching event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Assign UI elements ONLY after DOM is loaded
    mainMenu = document.getElementById('mainMenu');
    startButton = document.getElementById('startButton');
    gameOverScreen = document.getElementById('gameOverScreen');
    finalScoreDisplay = document.getElementById('finalScore');
    restartButton = document.getElementById('restartButton');
    // Correctly get references to mobile control elements
    mobileControls = document.getElementById('mobileControls');
    leftButton = document.getElementById('leftButton');
    rightButton = document.getElementById('rightButton');
    shootButton = document.getElementById('shootButton');
    fullscreenButton = document.getElementById('fullscreenButton');

    // Button click listeners - Now playing tap sound
    if (startButton) {
        startButton.addEventListener('click', () => {
            playTapSound();
            startGame();
        });
    } else {
        console.error("ERROR: startButton element not found after DOMContentLoaded. Check index.html IDs.");
    }
    if (restartButton) {
        restartButton.addEventListener('click', () => {
            playTapSound();
            startGame();
        });
    } else {
        console.error("ERROR: restartButton element not found after DOMContentLoaded. Check index.html IDs.");
    }
    if (fullscreenButton) {
        fullscreenButton.addEventListener('click', toggleFullscreen); // toggleFullscreen already plays sound
    } else {
        console.error("ERROR: fullscreenButton element not found after DOMContentLoaded. Check index.html IDs.");
    }

    // Also check for robustness
    if (!mainMenu) console.error("ERROR: mainMenu element not found after DOMContentLoaded. Check index.html IDs.");
    if (!gameOverScreen) console.error("ERROR: gameOverScreen element not found after DOMContentLoaded. Check index.html IDs.");
    if (!finalScoreDisplay) console.error("ERROR: finalScoreDisplay element not found after DOMContentLoaded. Check index.html IDs.");
    if (!mobileControls) console.error("ERROR: mobileControls element not found after DOMContentLoaded. Check index.html IDs.");
    if (!leftButton) console.error("ERROR: leftButton element not found after DOMContentLoaded. Check index.html IDs.");
    if (!rightButton) console.error("ERROR: rightButton element not found after DOMContentLoaded. Check index.html IDs.");
    if (!shootButton) console.error("ERROR: shootButton element not found after DOMContentLoaded. Check index.html IDs.");

    // Set up mobile controls now that buttons are available
    setupMobileControls();
});
