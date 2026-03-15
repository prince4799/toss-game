
/**
 * COIN TOSS GAME ENGINE
 * Optimized for React Native WebView
 */
class CoinGame {
    constructor() {
        this.state = {
            isFlipping: false,
            result: null,
            stats: { heads: 0, tails: 0 }
        };

        // DOM Elements
        this.camera = document.getElementById('camera-wrapper');
        this.hand = document.getElementById('hand-container');
        this.coinPhysics = document.getElementById('coin-physics-wrapper');
        this.coin = document.getElementById('coin');
        this.resultText = document.getElementById('result-text');
        this.env = document.getElementById('environment');

        // Physics Variables
        this.yPos = 0;
        this.velocity = 0;
        this.gravity = 1.3;
        this.rotationX = 0;
        this.spinSpeed = 0;

        this.initInteractions();
        this.notifyApp('GAME_READY');
    }

    initInteractions() {
        // Screen tap to toss
        document.body.addEventListener('pointerdown', () => {
            if (!this.state.isFlipping) this.toss();
        });

        // if(this.state.isFlipping) document.getElementById('coin').innerText = 'wait';
    }

    toss() {
        this.state.isFlipping = true;
        this.notifyApp('TOSS_STARTED');

        // 1. Flick Animation (Thumb snaps back)
        this.hand.classList.add('flick');
        this.playSound('flick');

        // 2. Determine Result Early
        this.state.result = Math.random() > 0.5 ? 'HEADS' : 'TAILS';
        this.notifyApp('RESULT_DETERMINED', { result: this.state.result });

        // 3. Setup Physics
        this.yPos = 0;
        this.velocity = 38; // Upward burst
        this.spinSpeed = 50; // Rapid spin

        // Calculate exact landing rotation target
        const extraRotations = 10 * 360;
        this.targetRotation = this.state.result === 'HEADS' ? extraRotations : extraRotations + 180;

        // Trigger Zoom Out & Hide Hand slightly after the flick
        setTimeout(() => {
            this.camera.classList.add('camera-zoom-out');
            this.hand.classList.add('hide-hand');

            // Start Animation Loop
            requestAnimationFrame(() => this.physicsLoop());
        }, 120);
    }

    physicsLoop() {
        // Apply Gravity
        this.velocity -= this.gravity;
        this.yPos += this.velocity;

        // Handle Spin
        if (this.velocity > 0) {
            // Going up - spin fast
            this.rotationX += this.spinSpeed;
        } else {
            // Falling down - smoothly transition to the final face (Head/Tails)
            this.rotationX += (this.targetRotation - this.rotationX) * 0.12;
        }

        // Update DOM
        this.coinPhysics.style.transform = `translateX(-50%) translateY(${-this.yPos}px)`;
        this.coin.style.transform = `rotateX(${this.rotationX}deg)`;

        // Camera zooms back in as it falls
        if (this.velocity < 0 && this.yPos < 200) {
            this.camera.classList.remove('camera-zoom-out');
            this.hand.classList.remove('hide-hand');
            this.hand.classList.remove('flick'); // Bring thumb back down to catch
        }

        // Collision with hand (yPos <= 0)
        if (this.yPos <= 0 && this.velocity < 0) {
            this.land();
        } else {
            requestAnimationFrame(() => this.physicsLoop());
        }
    }

    land() {
        this.yPos = 0;
        this.coinPhysics.style.transform = `translateX(-50%) translateY(0px)`;
        this.coin.style.transform = `rotateX(${this.targetRotation}deg)`; // Lock to result

        this.playSound('land');
        this.triggerHaptic();

        // Update Stats
        if (this.state.result === 'HEADS') this.state.stats.heads++;
        else this.state.stats.tails++;

        document.getElementById('heads-count').innerText = this.state.stats.heads;
        document.getElementById('tails-count').innerText = this.state.stats.tails;

        // Show Result Text
        this.resultText.innerText = this.state.result;
        this.resultText.classList.add('show-result');

        this.notifyApp('TOSS_LANDED', {
            result: this.state.result,
            stats: this.state.stats
        });

        // Reset UI after delay
        setTimeout(() => {
            this.resultText.classList.remove('show-result');
            this.state.isFlipping = false;
        }, 1500);
    }

    // --- Hardware & Bridge Integration ---

    playSound(type) {
        // Sends message to React Native to trigger native low-latency audio
        this.notifyApp('PLAY_SOUND', { sound: type });
    }

    triggerHaptic() {
        if (navigator.vibrate) navigator.vibrate(50); // Fallback for browsers
        this.notifyApp('HAPTIC_FEEDBACK'); // Tell React Native to trigger haptics
    }

    notifyApp(eventName, payload = {}) {
        if (window.ReactNativeWebView) {
            const message = JSON.stringify({ event: eventName, ...payload });
            window.ReactNativeWebView.postMessage(message);
        } else {
            console.log(`[WebView Bridge] ${eventName}`, payload);
        }
    }

    // --- Customization API ---
    setSkin(category, skinId) {
        if (category === 'coin') this.coin.setAttribute('data-skin', skinId);
        if (category === 'background') this.env.setAttribute('data-skin', skinId);
    }
}

// Initialize Game
const game = new CoinGame();

// Global API exposed for React Native to call via `injectedJavaScript`
window.gameAPI = {
    triggerToss: () => { if (!game.state.isFlipping) game.toss(); },
    setCustomization: (category, skinId) => { game.setSkin(category, skinId); },
    resetStats: () => {
        game.state.stats = { heads: 0, tails: 0 };
        document.getElementById('heads-count').innerText = '0';
        document.getElementById('tails-count').innerText = '0';
    }
};
