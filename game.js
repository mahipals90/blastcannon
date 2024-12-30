class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.setupCanvas();
        
        // Game state
        this.level = 1;
        this.score = 0;
        this.scoreElement = document.getElementById('score');
        this.highScore = localStorage.getItem('highScore') || 0;
        this.isPlaying = false;
        this.isPaused = false;
        this.levelStartTime = 0;
        this.levelDuration = 1 * 60 * 1000; // 1 minute in milliseconds
        this.isFiring = false;
        this.lastFireTime = 0;
        this.fireRate = 200; // Time between shots in milliseconds
        // Check if device is mobile
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.maxBallsOnScreen = this.isMobile ? 6 : 10; // 6 balls for mobile, 10 for desktop
        this.cannonFrozen = false;
        this.cannonUnfreezeClicks = 0;
        this.fixCannonText = document.getElementById('fixCannonText');
        this.levelChangeNotification = document.getElementById('levelChangeNotification');
        this.cannonInvulnerable = false;
        this.cannonInvulnerableTimer = 0;
        this.cannonInvulnerableDuration = 5000; // 5 seconds in milliseconds
        
        // Load cannon image
        this.cannonImage = new Image();
        this.cannonImage.src = 'https://raw.githubusercontent.com/mahipals90/blastcannon/refs/heads/main/cannon.png';
        
        // Cannon properties
        this.cannon = {
            x: this.canvas.width / 2,
            y: this.canvas.height - 80, // Adjusted for image height
            width: 80, // Adjusted for image width
            height: 80, // Adjusted for image height
            speed: 5,
            flash: false
        };
        
        // Audio setup
        this.backgroundMusic = document.getElementById('backgroundMusic');
        this.shootSound = document.getElementById('shootSound');
        this.explosionSound = document.getElementById('explosionSound');
        this.isMusicOn = true;
        
        // Set initial volume
        this.backgroundMusic.volume = 0.3; // Lower volume for background music
        this.shootSound.volume = 0.4;
        this.explosionSound.volume = 0.4;

        // Ensure music loads and plays
        this.backgroundMusic.load();
        
        // Game objects
        this.balls = [];
        this.projectiles = [];
        this.blasts = []; // Add this line for blast animations
        this.levelUpBall = null;
        this.levelBlinkTimer = 0;
        this.hitNumbers = [];
        
        // Controls
        this.keys = {
            ArrowLeft: false,
            ArrowRight: false
        };
        this.targetX = null;

        // Event listeners
        this.initializeControls();
        
        // Start screen elements
        this.playButton = document.getElementById('playButton');
        this.musicToggle = document.getElementById('musicToggle');
        this.startScreen = document.getElementById('startScreen');
        this.gameScreen = document.getElementById('gameScreen');
        this.pauseButton = document.getElementById('pauseButton');
        this.pauseButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.togglePause();
        });

        this.pauseButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.togglePause();
        });
        
        // Initialize UI
        this.updateHighScore();
        this.setupStartScreen();
    }

    setupCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.cannon.y = this.canvas.height - 80;
        });
    }

    setupStartScreen() {
        this.playButton.addEventListener('click', () => this.startGame());
        this.musicToggle.addEventListener('click', () => this.toggleMusic());
        this.backgroundMusic.play().catch(error => {
            console.log("Audio playback failed:", error);
        });
    }

    initializeControls() {
        // Touch controls for cannon movement and firing
        let touchStartX = null;
        let touchStartTime = null;
        let isTouchingCannon = false;
        const tapThreshold = 200; // ms to distinguish between tap and drag

        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.isPaused) return;
            
            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartTime = Date.now();
            
            // Get touch position relative to canvas
            const rect = this.canvas.getBoundingClientRect();
            const touchX = touch.clientX - rect.left;
            const touchY = touch.clientY - rect.top;
            
            // Check if touch is on cannon
            const cannonCenterX = this.cannon.x + this.cannon.width / 2;
            const cannonCenterY = this.cannon.y + this.cannon.height / 2;
            const distance = Math.sqrt(
                Math.pow(touchX - cannonCenterX, 2) + 
                Math.pow(touchY - cannonCenterY, 2)
            );
            
            // If touch is within cannon area, start firing
            if (distance < this.cannon.width * 1.5 && !this.cannonFrozen) {
                isTouchingCannon = true;
                this.isFiring = true;
            }
            
            // Update cannon target position
            this.targetX = touchX - this.cannon.width / 2;
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (this.isPaused) return;
            
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const touchX = touch.clientX - rect.left;
            const touchY = touch.clientY - rect.top;
            
            // Check if touch is still on cannon
            const cannonCenterX = this.cannon.x + this.cannon.width / 2;
            const cannonCenterY = this.cannon.y + this.cannon.height / 2;
            const distance = Math.sqrt(
                Math.pow(touchX - cannonCenterX, 2) + 
                Math.pow(touchY - cannonCenterY, 2)
            );
            
            // Update firing state based on whether touch is still on cannon
            if (isTouchingCannon) {
                this.isFiring = distance < this.cannon.width * 1.5;
            }
            
            // Only move cannon if not frozen
            if (!this.cannonFrozen) {
                this.targetX = touchX - this.cannon.width / 2;
            }
        });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            
            // Stop firing when touch ends
            if (isTouchingCannon) {
                this.isFiring = false;
                isTouchingCannon = false;
            }
            
            if (this.isPaused) return;
            
            const touchEndTime = Date.now();
            touchStartX = null;
            touchStartTime = null;
        });

        // Mouse controls (keep these for desktop compatibility)
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isPaused || this.cannonFrozen) return;
            
            const rect = this.canvas.getBoundingClientRect();
            this.targetX = e.clientX - rect.left - this.cannon.width / 2;
        });

        this.canvas.addEventListener('mousedown', (e) => {
            if (this.isPaused || this.cannonFrozen) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Check if click is on cannon
            const cannonCenterX = this.cannon.x + this.cannon.width / 2;
            const cannonCenterY = this.cannon.y + this.cannon.height / 2;
            const distance = Math.sqrt(
                Math.pow(mouseX - cannonCenterX, 2) + 
                Math.pow(mouseY - cannonCenterY, 2)
            );
            
            if (distance < this.cannon.width * 1.5) {
                this.isFiring = true;
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            this.isFiring = false;
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.isFiring = false;
        });

        // Handle cannon unfreezing
        const handleUnfreeze = (e) => {
            if (!this.cannonFrozen) return;
            
            const rect = this.canvas.getBoundingClientRect();
            let clickX, clickY;
            
            if (e.type.includes('touch')) {
                e.preventDefault(); // Prevent default touch behavior
                clickX = e.touches[0].clientX - rect.left;
                clickY = e.touches[0].clientY - rect.top;
            } else {
                clickX = e.clientX - rect.left;
                clickY = e.clientY - rect.top;
            }
            
            const cannonCenterX = this.cannon.x + this.cannon.width / 2;
            const cannonCenterY = this.cannon.y + this.cannon.height / 2;
            
            const distance = Math.sqrt(
                Math.pow(clickX - cannonCenterX, 2) + 
                Math.pow(clickY - cannonCenterY, 2)
            );
            
            if (distance < this.cannon.width * 1.5) { // Increased touch area for mobile
                this.cannonUnfreezeClicks++;
                if (this.cannonUnfreezeClicks >= 5) {
                    this.unfreezeCannon();
                }
            }
        };

        // Remove previous event listeners if they exist
        this.canvas.removeEventListener('click', handleUnfreeze);
        this.canvas.removeEventListener('touchstart', handleUnfreeze);
        
        // Add event listeners for both mouse and touch
        this.canvas.addEventListener('click', handleUnfreeze);
        this.canvas.addEventListener('touchstart', handleUnfreeze, { passive: false });
    }

    unfreezeCannon() {
        if (this.cannonFrozen && this.cannonUnfreezeClicks >= 5) {
            this.cannonFrozen = false;
            this.cannonUnfreezeClicks = 0;
            this.fixCannonText.style.display = 'none';
            
            // Make cannon invulnerable
            this.cannonInvulnerable = true;
            this.cannonInvulnerableTimer = Date.now();
            
            // Flash effect to show invulnerability
            this.cannon.flash = true;
            setTimeout(() => {
                this.cannon.flash = false;
            }, 200);
        }
    }

    updateCannon() {
        // Update invulnerability status
        if (this.cannonInvulnerable) {
            const currentTime = Date.now();
            if (currentTime - this.cannonInvulnerableTimer >= this.cannonInvulnerableDuration) {
                this.cannonInvulnerable = false;
            }
        }

        // Check for ball collisions only if not invulnerable
        if (!this.cannonInvulnerable) {
            for (const ball of this.balls) {
                const dx = (this.cannon.x + this.cannon.width / 2) - ball.x;
                const dy = (this.cannon.y + this.cannon.height / 2) - ball.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < ball.radius + Math.min(this.cannon.width, this.cannon.height) / 2) {
                    if (!this.cannonFrozen) {
                        this.cannonFrozen = true;
                        this.cannonHits++;
                        this.fixCannonText.style.display = 'block';
                    }
                }
            }
        }

        // Move cannon based on target position if not frozen
        if (!this.cannonFrozen && this.targetX !== null) {
            const dx = this.targetX - this.cannon.x;
            this.cannon.x += dx * 0.2; // Smoother movement

            // Keep cannon within canvas bounds
            this.cannon.x = Math.max(0, Math.min(this.canvas.width - this.cannon.width, this.cannon.x));
        }

        // Handle automatic firing if active
        if (this.isFiring && !this.cannonFrozen) {
            const currentTime = Date.now();
            if (currentTime - this.lastFireTime >= this.fireRate) {
                this.shootProjectile();
                this.lastFireTime = currentTime;
            }
        }
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseLine = document.getElementById('pauseLine');
        
        if (this.isPaused) {
            pauseLine.style.display = 'block';
            // Stop firing when paused
            this.isFiring = false;
        } else {
            pauseLine.style.display = 'none';
        }
    }

    toggleMusic() {
        this.isMusicOn = !this.isMusicOn;
        const musicLine = document.getElementById('musicLine');
        
        if (this.isMusicOn) {
            this.backgroundMusic.play();
            musicLine.classList.add('hidden');
        } else {
            this.backgroundMusic.pause();
            musicLine.classList.remove('hidden');
        }
    }

    startGame() {
        this.isPlaying = true;
        this.startScreen.classList.add('hidden');
        this.gameScreen.classList.remove('hidden');
        this.levelStartTime = Date.now();
        this.cannonFrozen = false;
        this.cannonUnfreezeClicks = 0;
        this.fixCannonText.style.display = 'none';
        
        // Start background music if it's enabled
        if (this.isMusicOn) {
            this.backgroundMusic.play().catch(error => {
                console.log("Audio playback failed:", error);
            });
        }
        
        this.gameLoop();
        this.spawnBalls();
    }

    updateHighScore() {
        document.getElementById('highScore').textContent = this.highScore;
        document.getElementById('currentScore').textContent = this.score;
        document.getElementById('currentLevel').textContent = this.level;
    }

    updateScore(points) {
        this.score += points;
        if (this.scoreElement) {
            this.scoreElement.textContent = this.score;
            
            // Add score pop-up animation
            const scorePopup = document.createElement('div');
            scorePopup.className = 'score-popup';
            scorePopup.textContent = `+${points}`;
            scorePopup.style.position = 'absolute';
            scorePopup.style.left = '50%';
            scorePopup.style.top = '100px';
            scorePopup.style.transform = 'translateX(-50%)';
            document.body.appendChild(scorePopup);
            
            // Remove the popup after animation
            setTimeout(() => {
                document.body.removeChild(scorePopup);
            }, 1000);
        }
    }

    shootProjectile() {
        // Calculate projectile properties based on level
        const baseSpeed = 10;
        const baseSize = 8;
        const speedIncrease = this.level * 1.5;
        const sizeIncrease = this.level * 0.8;
        
        const projectile = {
            x: this.cannon.x + this.cannon.width / 2,
            y: this.cannon.y,
            radius: baseSize + sizeIncrease,
            speed: baseSpeed + speedIncrease,
            color: this.getProjectileColor()
        };
        this.projectiles.push(projectile);
        this.shootSound.currentTime = 0;
        this.shootSound.play();
    }

    getProjectileColor() {
        // Different color schemes for different level ranges
        const levelRange = Math.floor((this.level - 1) / 3);
        switch(levelRange) {
            case 0: // Levels 1-3: Red to Orange
                return `hsl(${0 + (this.level * 10)}, 100%, 50%)`;
            case 1: // Levels 4-6: Orange to Yellow
                return `hsl(${30 + (this.level * 10)}, 100%, 50%)`;
            case 2: // Levels 7-9: Yellow to Green
                return `hsl(${60 + (this.level * 10)}, 100%, 50%)`;
            case 3: // Levels 10-12: Green to Blue
                return `hsl(${120 + (this.level * 10)}, 100%, 50%)`;
            case 4: // Levels 13-15: Blue to Purple
                return `hsl(${240 + (this.level * 10)}, 100%, 50%)`;
            default: // Level 16+: Random vibrant colors
                return `hsl(${Math.random() * 360}, 100%, 50%)`;
        }
    }

    spawnBalls() {
        if (!this.isPlaying) return;

        // Adjust spawn rate based on device type
        const spawnDelay = this.isMobile ? 800 : 500; // Slower spawn rate on mobile

        // Only spawn new balls if we're under the limit
        if (this.balls.length >= this.maxBallsOnScreen) {
            setTimeout(() => this.spawnBalls(), spawnDelay);
            return;
        }

        // Calculate ball properties based on level and device type
        const baseSpeed = this.isMobile ? 2 : 3;
        const speedMultiplier = this.isMobile ? 0.8 : 1;
        const speed = (baseSpeed + (this.level * 0.5)) * speedMultiplier;
        
        const radius = Math.random() * (30 - 15) + 15;
        const x = Math.random() * (this.canvas.width - radius * 2) + radius;
        
        const ball = {
            x: x,
            y: -radius,
            radius: radius,
            dx: (Math.random() - 0.5) * speed,
            dy: speed,
            color: `hsl(${Math.random() * 360}, 70%, 50%)`
        };
        
        this.balls.push(ball);
        setTimeout(() => this.spawnBalls(), spawnDelay);
    }

    spawnLevelUpBall() {
        if (this.levelUpBall === null) {
            this.levelUpBall = {
                x: Math.random() * (this.canvas.width - 80) + 40,
                y: -40,
                radius: 40,
                dy: 3,
                blinkOn: true,
                nextLevel: this.level + 1
            };
            this.levelBlinkTimer = 0;
        }
    }

    update() {
        if (this.isPaused) return;

        this.updateCannon();

        // Update fix cannon text position
        if (this.cannonFrozen) {
            this.fixCannonText.style.left = (this.cannon.x + this.cannon.width / 2) + 'px';
            this.fixCannonText.style.top = (this.cannon.y - 30) + 'px';
            this.fixCannonText.style.display = 'block';
            this.fixCannonText.textContent = `TAP TO FIX IT (${5 - this.cannonUnfreezeClicks} TAPS LEFT)`;
        } else {
            this.fixCannonText.style.display = 'none';
        }

        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            this.projectiles[i].y -= this.projectiles[i].speed;
            if (this.projectiles[i].y < 0) {
                this.projectiles.splice(i, 1);
            }
        }

        // Update balls
        for (let i = this.balls.length - 1; i >= 0; i--) {
            const ball = this.balls[i];
            
            // Update position
            ball.x += ball.dx;
            ball.y += ball.dy;
            
            // Bounce off walls
            if (ball.x - ball.radius < 0 || ball.x + ball.radius > this.canvas.width) {
                ball.dx *= -1;
            }
            
            // Bounce off bottom
            if (ball.y + ball.radius > this.canvas.height) {
                ball.dy = -Math.abs(ball.dy); // Ensure upward movement
                ball.dx = (Math.random() - 0.5) * 4; // Random horizontal direction
            }
            
            // Return to top if ball goes too high
            if (ball.y + ball.radius < -100) {
                ball.y = -ball.radius;
                ball.x = Math.random() * (this.canvas.width - ball.radius * 2) + ball.radius;
                ball.dy = Math.abs(ball.dy); // Ensure downward movement
                ball.dx = (Math.random() - 0.5) * 2; // New random horizontal direction
            }
        }

        this.checkCollisions();
        this.checkLevelProgress();

        // Update high score
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('highScore', this.highScore);
        }
        this.updateHighScore();
    }

    drawBlast(x, y) {
        const radius = 20;
        const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, 'rgba(255, 200, 0, 0.8)');
        gradient.addColorStop(0.5, 'rgba(255, 100, 0, 0.5)');
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
    }

    checkCollisions() {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            let collisionOccurred = false;

            for (let j = this.balls.length - 1; j >= 0; j--) {
                const ball = this.balls[j];
                const dx = proj.x - ball.x;
                const dy = proj.y - ball.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < ball.radius + proj.radius) {
                    collisionOccurred = true;
                    
                    // Add points for hitting the ball
                    this.updateScore(10);
                    
                    // Reduce ball's number
                    ball.number--;
                    
                    // Add hit number animation
                    this.addHitNumberAnimation(ball.x, ball.y, ball.number + 1);
                    
                    // Add blast animation
                    this.blasts.push({
                        x: proj.x,
                        y: proj.y,
                        duration: 15
                    });

                    // Play explosion sound
                    this.explosionSound.currentTime = 0;
                    this.explosionSound.play();

                    if (ball.number <= 0) {
                        // Ball is destroyed, add bonus points
                        this.updateScore(50); // Bonus for destroying the ball
                        this.balls.splice(j, 1);
                    }
                    break;
                }
            }

            if (collisionOccurred) {
                this.projectiles.splice(i, 1);
            }
        }
    }

    addHitNumberAnimation(x, y, number) {
        if (!this.hitNumbers) this.hitNumbers = [];
        
        this.hitNumbers.push({
            x: x,
            y: y,
            number: number,
            opacity: 1,
            scale: 1.5,
            duration: 30 // frames the number will be visible
        });
    }

    checkLevelProgress() {
        const currentTime = Date.now();
        if (currentTime - this.levelStartTime >= this.levelDuration) {
            this.spawnLevelUpBall();
        }

        // Update level up ball if it exists
        if (this.levelUpBall) {
            this.levelUpBall.y += this.levelUpBall.dy;
            
            // Bounce off walls
            if (this.levelUpBall.x - this.levelUpBall.radius < 0 || 
                this.levelUpBall.x + this.levelUpBall.radius > this.canvas.width) {
                this.levelUpBall.dx *= -1;
            }
            
            // Bounce off bottom
            if (this.levelUpBall.y + this.levelUpBall.radius > this.canvas.height) {
                this.levelUpBall.dy = -Math.abs(this.levelUpBall.dy);
            }
            
            // Return to top if ball goes too high
            if (this.levelUpBall.y + this.levelUpBall.radius < -100) {
                this.levelUpBall.y = -this.levelUpBall.radius;
                this.levelUpBall.x = Math.random() * (this.canvas.width - this.levelUpBall.radius * 2) + this.levelUpBall.radius;
                this.levelUpBall.dy = Math.abs(this.levelUpBall.dy);
            }

            // Blink effect
            this.levelBlinkTimer++;
            if (this.levelBlinkTimer >= 10) { // Faster blinking
                this.levelUpBall.blinkOn = !this.levelUpBall.blinkOn;
                this.levelBlinkTimer = 0;
            }

            // Check for collisions with projectiles
            for (let i = this.projectiles.length - 1; i >= 0; i--) {
                const proj = this.projectiles[i];
                const dx = proj.x - this.levelUpBall.x;
                const dy = proj.y - this.levelUpBall.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < this.levelUpBall.radius + proj.radius) {
                    // Level up effects
                    this.level = this.levelUpBall.nextLevel;
                    this.levelStartTime = Date.now();
                    this.levelUpBall = null;
                    this.projectiles.splice(i, 1);
                    
                    // Show level change notification
                    this.showLevelChangeNotification(this.level);
                    
                    // Add multiple blast animations for more impact
                    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
                        const blastX = proj.x + Math.cos(angle) * 20;
                        const blastY = proj.y + Math.sin(angle) * 20;
                        this.blasts.push({
                            x: blastX,
                            y: blastY,
                            duration: 15
                        });
                    }
                    
                    // Play explosion sound
                    this.explosionSound.currentTime = 0;
                    this.explosionSound.play();
                    break;
                }
            }
        }
    }

    showLevelChangeNotification(level) {
        const levelNumber = this.levelChangeNotification.querySelector('.level-number');
        levelNumber.textContent = level;
        this.levelChangeNotification.classList.remove('hidden');
        this.levelChangeNotification.classList.add('show');
        
        // Remove the show class after animation completes
        setTimeout(() => {
            this.levelChangeNotification.classList.remove('show');
            this.levelChangeNotification.classList.add('hidden');
        }, 2000);
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw level up ball if it exists
        if (this.levelUpBall) {
            if (this.levelUpBall.blinkOn) {
                // Draw outer glow
                const gradient = this.ctx.createRadialGradient(
                    this.levelUpBall.x, this.levelUpBall.y, this.levelUpBall.radius * 0.8,
                    this.levelUpBall.x, this.levelUpBall.y, this.levelUpBall.radius * 1.2
                );
                gradient.addColorStop(0, `hsl(${(this.level * 60) % 360}, 80%, 60%)`);
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                
                this.ctx.beginPath();
                this.ctx.arc(this.levelUpBall.x, this.levelUpBall.y, this.levelUpBall.radius * 1.2, 0, Math.PI * 2);
                this.ctx.fillStyle = gradient;
                this.ctx.fill();

                // Draw ball
                this.ctx.beginPath();
                this.ctx.arc(this.levelUpBall.x, this.levelUpBall.y, this.levelUpBall.radius, 0, Math.PI * 2);
                this.ctx.fillStyle = `hsl(${(this.level * 60) % 360}, 80%, 60%)`;
                this.ctx.fill();

                // Draw level text with shadow
                this.ctx.save();
                this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                this.ctx.shadowBlur = 4;
                this.ctx.shadowOffsetX = 2;
                this.ctx.shadowOffsetY = 2;
                this.ctx.fillStyle = 'white';
                this.ctx.font = 'bold 32px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(`${this.levelUpBall.nextLevel}`, this.levelUpBall.x, this.levelUpBall.y);
                this.ctx.restore();
            }
        }

        // Draw blasts
        for (let i = this.blasts.length - 1; i >= 0; i--) {
            const blast = this.blasts[i];
            this.drawBlast(blast.x, blast.y);
            blast.duration--;
            if (blast.duration <= 0) {
                this.blasts.splice(i, 1);
            }
        }

        // Draw cannon with invulnerability effect
        this.ctx.save();
        if (this.cannonFrozen) {
            this.ctx.globalAlpha = 0.5;
        } else if (this.cannonInvulnerable) {
            // Create pulsing golden glow effect
            const pulseIntensity = (Math.sin(Date.now() / 100) + 1) / 2;
            this.ctx.shadowColor = `rgba(255, 215, 0, ${pulseIntensity})`;
            this.ctx.shadowBlur = 20;
            
            // Draw shield aura
            this.ctx.beginPath();
            this.ctx.arc(
                this.cannon.x + this.cannon.width / 2,
                this.cannon.y + this.cannon.height / 2,
                Math.max(this.cannon.width, this.cannon.height) / 1.5,
                0, Math.PI * 2
            );
            this.ctx.fillStyle = `rgba(255, 215, 0, ${0.2 + (pulseIntensity * 0.2)})`;
            this.ctx.fill();
        }
        this.ctx.drawImage(this.cannonImage, this.cannon.x, this.cannon.y, this.cannon.width, this.cannon.height);
        this.ctx.restore();

        // Draw projectiles with glow effect
        for (const proj of this.projectiles) {
            // Draw glow
            this.ctx.save();
            this.ctx.shadowColor = proj.color;
            this.ctx.shadowBlur = 15;
            this.ctx.beginPath();
            this.ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = proj.color;
            this.ctx.fill();

            // Draw inner core
            this.ctx.beginPath();
            this.ctx.arc(proj.x, proj.y, proj.radius * 0.6, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.fill();
            this.ctx.restore();
        }

        // Draw balls
        for (const ball of this.balls) {
            // Draw the ball
            this.ctx.beginPath();
            this.ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = `hsl(${(ball.number * 20) % 360}, 70%, 50%)`;
            this.ctx.fill();

            // Draw the number
            this.ctx.fillStyle = 'white';
            this.ctx.font = '20px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(ball.number.toString(), ball.x, ball.y);
        }

        // Draw hit number animations
        if (this.hitNumbers) {
            for (let i = this.hitNumbers.length - 1; i >= 0; i--) {
                const hitNum = this.hitNumbers[i];
                hitNum.duration--;
                hitNum.y -= 2; // Move up
                hitNum.opacity = hitNum.duration / 30; // Fade out
                hitNum.scale = Math.max(1, hitNum.scale - 0.03); // Shrink

                if (hitNum.duration <= 0) {
                    this.hitNumbers.splice(i, 1);
                    continue;
                }

                // Draw the hit number
                this.ctx.save();
                this.ctx.globalAlpha = hitNum.opacity;
                this.ctx.fillStyle = '#FFD700'; // Golden color
                this.ctx.font = `bold ${Math.floor(24 * hitNum.scale)}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                
                // Draw text shadow
                this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                this.ctx.shadowBlur = 4;
                this.ctx.shadowOffsetX = 1;
                this.ctx.shadowOffsetY = 1;
                
                this.ctx.fillText(hitNum.number.toString(), hitNum.x, hitNum.y);
                this.ctx.restore();
            }
        }

        // ... rest of draw code ...
    }

    gameLoop() {
        if (!this.isPlaying) return;
        
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new Game();
});
