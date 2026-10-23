(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const shell = document.querySelector(".game-shell");
  const overlay = document.querySelector("#overlay");
  const scoreLabel = document.querySelector("#score");
  const bestLabel = document.querySelector("#best");
  const overlayBestLabel = document.querySelector("#overlay-best");
  const overlayTitle = document.querySelector("#overlay-title");
  const overlaySubtitle = document.querySelector("#overlay-subtitle");
  const playLabel = document.querySelector("#play-label");
  const playButton = document.querySelector("#play-button");
  const pauseButton = document.querySelector("#pause-button");
  const soundButton = document.querySelector("#sound-button");
  const ebookPopup = document.querySelector("#ebook-popup");
  const ebookCloseButton = document.querySelector("#ebook-close");
  const toast = document.querySelector("#toast");
  const healthTrack = document.querySelector("#health-track");
  const healthFill = document.querySelector("#health-fill");
  const levelLabel = document.querySelector("#level");
  const coinsLabel = document.querySelector("#coins");
  const pumpkinChoices = document.querySelectorAll(".pumpkin-choice");

  const colors = {
    cyan: "#ff9b35",
    pink: "#ff6e61",
    purple: "#ae82e8",
    white: "#fff8ee"
  };
  const levels = [
    { name: "GRAVEYARD", sky: ["#100b20", "#241534", "#100d1b"], ground: "#100e1a", accent: "#ae82e8", ghost: "#e6e0ff" },
    { name: "WITCHWOOD", sky: ["#071b1b", "#123b32", "#091713"], ground: "#081610", accent: "#77d4a1", ghost: "#d9ffe8" },
    { name: "BLOOD MOON", sky: ["#220d1b", "#511b2c", "#170b17"], ground: "#160b15", accent: "#ff6e61", ghost: "#ffe0dc" },
    { name: "FROST CRYPT", sky: ["#081524", "#17334a", "#0a1422"], ground: "#091522", accent: "#8fe8ff", ghost: "#e0f9ff" }
  ];
  const pumpkins = {
    ember: { color: "#f47a22", shade: "#d95d1b", glow: "rgba(255, 155, 53, 0.15)", trail: "#ff9b35" },
    mint: { color: "#70c98b", shade: "#3b9a65", glow: "rgba(112, 201, 139, 0.18)", trail: "#8effba" },
    berry: { color: "#cf6389", shade: "#9c3c68", glow: "rgba(207, 99, 137, 0.18)", trail: "#ff8db5" },
    moon: { color: "#a3b8e8", shade: "#7187bd", glow: "rgba(163, 184, 232, 0.18)", trail: "#d7e4ff" }
  };
  const levelDuration = 20;
  const maxHealth = 3;
  const stars = [];
  const objects = [];
  const particles = [];
  const player = { x: 0.5, targetX: 0.5, y: 0, tilt: 0, trail: [] };
  let health = maxHealth;
  let currentLevel = 0;
  let selectedPumpkin = "ember";
  let width = 0;
  let height = 0;
  let dpr = 1;
  let state = "ready";
  let score = 0;
  let coins = 0;
  let best = 0;
  let elapsed = 0;
  let spawnClock = 0;
  let lastFrame = 0;
  let shake = 0;
  let muted = false;
  let audio = null;
  let pointerActive = false;
  let toastTimer = 0;
  let invulnerableFor = 0;

  function formatScore(value) {
    return String(Math.floor(value)).padStart(6, "0");
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    player.y = height * (width < 600 ? 0.77 : 0.78);
    if (stars.length === 0) {
      for (let i = 0; i < 85; i++) {
        stars.push({
          x: Math.random(),
          y: Math.random(),
          size: Math.random() * 1.5 + 0.25,
          phase: Math.random() * Math.PI * 2
        });
      }
    }
  }

  function setScore(value) {
    scoreLabel.textContent = formatScore(value);
    bestLabel.textContent = formatScore(best);
    overlayBestLabel.textContent = formatScore(best);
  }

  function setCoins(value) {
    coins = value;
    coinsLabel.textContent = String(coins).padStart(4, "0");
  }

  function setHealth(value) {
    health = Math.max(0, Math.min(maxHealth, value));
    healthTrack.setAttribute("aria-valuenow", String(health));
    healthFill.style.width = `${(health / maxHealth) * 100}%`;
    healthTrack.classList.toggle("is-low", health === 1);
  }

  function updateLevel() {
    const nextLevel = Math.min(levels.length - 1, Math.floor(elapsed / levelDuration));
    if (nextLevel === currentLevel) return;
    currentLevel = nextLevel;
    const level = levels[currentLevel];
    levelLabel.textContent = `${String(currentLevel + 1).padStart(2, "0")} · ${level.name}`;
    showToast(`LEVEL ${currentLevel + 1}: ${level.name}`);
  }

  function startGame() {
    score = 0;
    setCoins(0);
    elapsed = 0;
    currentLevel = 0;
    levelLabel.textContent = `01 · ${levels[0].name}`;
    setHealth(maxHealth);
    spawnClock = 0.45;
    shake = 0;
    invulnerableFor = 0;
    objects.length = 0;
    particles.length = 0;
    player.x = 0.5;
    player.targetX = 0.5;
    player.tilt = 0;
    player.trail.length = 0;
    setScore(0);
    state = "playing";
    shell.classList.remove("is-game-over");
    overlay.classList.add("is-hidden");
    playButton.hidden = false;
    playLabel.textContent = "START RUN";
    shell.classList.add("is-playing");
    pauseButton.setAttribute("aria-label", "Pause game");
    playTone(440, 0.08, "sine", 0.035);
  }

  function pauseGame() {
    if (state === "playing") {
      state = "paused";
      showOverlay("PAUSED", "Catch your breath.<br>The ghosts are still waiting.", "RESUME RUN");
      pauseButton.setAttribute("aria-label", "Resume game");
      shell.classList.remove("is-playing");
    } else if (state === "paused") {
      state = "playing";
      overlay.classList.add("is-hidden");
      pauseButton.setAttribute("aria-label", "Pause game");
      shell.classList.add("is-playing");
      shell.classList.remove("is-game-over");
      lastFrame = performance.now();
    }
  }

  function endGame() {
    if (state !== "playing") return;
    state = "over";
    const newBest = score > best;
    if (newBest) {
      best = score;
    }
    setScore(score);
    showOverlay(newBest ? "NEW<br>RECORD" : "RUN<br>OVER",
      "Your score is safe.<br>Play again to beat your best.",
      "PLAY AGAIN");
    shell.classList.add("is-game-over");
    playButton.hidden = false;
    if (newBest) showToast("NEW PERSONAL BEST");
    shell.classList.remove("is-playing");
    pauseButton.setAttribute("aria-label", "Pause game");
    burst(player.x * width, player.y, colors.pink, 28);
    shake = 0.38;
    playTone(125, 0.28, "sawtooth", 0.06);
  }

  function showOverlay(title, subtitle, buttonText) {
    overlayTitle.innerHTML = title;
    overlaySubtitle.innerHTML = subtitle;
    playLabel.textContent = buttonText;
    overlay.classList.remove("is-hidden");
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 1250);
  }

  function playTone(frequency, duration, type, volume) {
    if (muted) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * 0.62), audio.currentTime + duration);
      gain.gain.setValueAtTime(volume, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + duration);
    } catch (error) {
      console.warn("Audio could not be started.", error);
    }
  }

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 45 + Math.random() * 250;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35 + Math.random() * 0.48,
        maxLife: 0.83,
        size: 1 + Math.random() * 3,
        color
      });
    }
  }

  function spawnObject() {
    const isCollectible = Math.random() < 0.28;
    const x = 0.09 + Math.random() * 0.82;
    const level = levels[currentLevel];
    objects.push({
      type: isCollectible ? "orb" : "ghost",
      ghostType: currentLevel,
      x,
      y: -38,
      size: isCollectible ? 13 : 19 + Math.random() * 8,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 2.2,
      passed: false,
      color: isCollectible ? colors.cyan : level.accent
    });
  }

  function moveToClientX(clientX) {
    const rect = canvas.getBoundingClientRect();
    player.targetX = Math.max(0.055, Math.min(0.945, (clientX - rect.left) / rect.width));
  }

  function update(dt) {
    elapsed += dt;
    updateLevel();
    invulnerableFor = Math.max(0, invulnerableFor - dt);
    score += dt * (10 + Math.min(elapsed * 0.9, 24));
    setScore(score);

    const speed = Math.min(320 + elapsed * 8, 670);
    player.x += (player.targetX - player.x) * Math.min(1, dt * 12);
    const targetTilt = Math.max(-0.42, Math.min(0.42, (player.targetX - player.x) * 6));
    player.tilt += (targetTilt - player.tilt) * Math.min(1, dt * 10);
    spawnClock -= dt;
    if (spawnClock <= 0) {
      spawnObject();
      spawnClock = Math.max(0.34, 0.82 - elapsed * 0.009) + Math.random() * 0.26;
    }

    player.trail.push({ x: player.x * width, y: player.y + 17, life: 0.35 });
    if (player.trail.length > 12) player.trail.shift();
    player.trail.forEach(point => { point.life -= dt; point.y += dt * 100; });
    player.trail = player.trail.filter(point => point.life > 0);

    for (let i = objects.length - 1; i >= 0; i--) {
      const object = objects[i];
      object.y += speed * dt;
      object.rotation += object.spin * dt;
      const ox = object.x * width;
      const px = player.x * width;
      if (Math.abs(object.y - player.y) < object.size + 17 && Math.abs(ox - px) < object.size + 17) {
        if (object.type === "orb") {
          score += 125;
          setCoins(coins + 10);
          burst(ox, object.y, colors.cyan, 15);
          playTone(700, 0.13, "triangle", 0.045);
          showToast("+10 COINS");
          objects.splice(i, 1);
          continue;
        }
        if (invulnerableFor <= 0) {
          if (typeof navigator.vibrate === "function") navigator.vibrate(120);
          setHealth(health - 1);
          invulnerableFor = 1.1;
          shake = 0.18;
          burst(px, player.y, colors.pink, 12);
          playTone(180, 0.16, "sawtooth", 0.045);
          objects.splice(i, 1);
          showToast(health > 0 ? "OUCH! -1 HEALTH" : "NO HEALTH LEFT!");
          if (health <= 0) {
            endGame();
            return;
          }
        }
      }
      if (object.y > height + 60) objects.splice(i, 1);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.985;
      particle.vy *= 0.985;
      if (particle.life <= 0) particles.splice(i, 1);
    }
  }

  function drawBackground(time) {
    const level = levels[currentLevel];
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, level.sky[0]);
    gradient.addColorStop(0.52, level.sky[1]);
    gradient.addColorStop(1, level.sky[2]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const moonX = width * 0.78;
    const moonY = height * 0.24;
    const moonRadius = Math.min(width, height) * 0.075;
    const moonGlow = ctx.createRadialGradient(moonX, moonY, moonRadius * 0.25, moonX, moonY, moonRadius * 3.5);
    moonGlow.addColorStop(0, `${level.accent}38`);
    moonGlow.addColorStop(1, `${level.accent}00`);
    ctx.fillStyle = moonGlow;
    ctx.fillRect(moonX - moonRadius * 4, moonY - moonRadius * 4, moonRadius * 8, moonRadius * 8);
    ctx.fillStyle = currentLevel === 2 ? "#ff9c86" : currentLevel === 3 ? "#c7efff" : "#f6dba8";
    ctx.shadowBlur = 26;
    ctx.shadowColor = level.accent;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(129, 89, 108, .24)";
    ctx.beginPath();
    ctx.arc(moonX - moonRadius * 0.35, moonY - moonRadius * 0.12, moonRadius * 0.2, 0, Math.PI * 2);
    ctx.arc(moonX + moonRadius * 0.33, moonY + moonRadius * 0.28, moonRadius * 0.13, 0, Math.PI * 2);
    ctx.fill();

    for (const star of stars) {
      const twinkle = 0.35 + Math.sin(time * 0.0014 + star.phase) * 0.24;
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = star.size > 1.15 ? "#ffd28d" : "#c7b4dc";
      ctx.fillRect(star.x * width, star.y * height, star.size, star.size);
    }
    ctx.globalAlpha = 1;

    const horizonY = height * 0.48;
    const scroll = (time * (state === "playing" ? 0.00032 + Math.min(elapsed * 0.000003, 0.0002) : 0.00011)) % 1;
    ctx.save();
    ctx.fillStyle = level.ground;
    ctx.beginPath();
    ctx.moveTo(0, horizonY + 18);
    for (let x = 0; x <= width; x += Math.max(28, width / 14)) {
      const hill = Math.sin(x * 0.012) * 16 + Math.sin(x * 0.027) * 9;
      ctx.lineTo(x, horizonY + 18 + hill);
    }
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    if (currentLevel === 1) {
      for (let i = 0; i < 8; i++) {
        const x = (i * width / 7 + Math.sin(i * 9) * 18) % width;
        const base = horizonY + 54 + Math.sin(x * 0.012) * 16;
        ctx.strokeStyle = i % 2 ? "#10251c" : "#153126";
        ctx.lineWidth = 5 + (i % 3) * 2;
        ctx.beginPath();
        ctx.moveTo(x, base);
        ctx.lineTo(x + Math.sin(i) * 12, base - 90 - (i % 3) * 20);
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + Math.sin(i) * 8, base - 56);
        ctx.lineTo(x - 18, base - 78);
        ctx.moveTo(x + Math.sin(i) * 8, base - 68);
        ctx.lineTo(x + 20, base - 92);
        ctx.stroke();
      }
    } else if (currentLevel === 2) {
      ctx.fillStyle = "#270f1b";
      for (let i = 0; i < 4; i++) {
        const x = i * width / 3.4;
        const castleHeight = 44 + (i % 2) * 30;
        ctx.fillRect(x, horizonY - castleHeight, width * 0.08, castleHeight + 28);
        ctx.beginPath();
        ctx.moveTo(x - 4, horizonY - castleHeight);
        ctx.lineTo(x + width * 0.04, horizonY - castleHeight - 16);
        ctx.lineTo(x + width * 0.08 + 4, horizonY - castleHeight);
        ctx.fill();
      }
    } else if (currentLevel === 3) {
      ctx.fillStyle = "rgba(143, 232, 255, .2)";
      for (let i = 0; i < 7; i++) {
        const x = (i * width / 6 + 11) % width;
        const base = horizonY + 38 + Math.sin(x * 0.012) * 16;
        ctx.beginPath();
        ctx.moveTo(x, base);
        ctx.lineTo(x + 8, base - 36 - (i % 3) * 12);
        ctx.lineTo(x + 16, base);
        ctx.closePath();
        ctx.fill();
      }
    }

    for (let i = 0; i < 7; i++) {
      const x = (i * width / 6 + (i % 2 ? 14 : -10)) % width;
      const base = horizonY + 34 + Math.sin(x * 0.012) * 16;
      const gravestoneWidth = 10 + (i % 3) * 5;
      const gravestoneHeight = 25 + (i % 4) * 8;
      ctx.fillStyle = currentLevel === 1
        ? (i % 2 ? "#10281e" : "#153126")
        : currentLevel === 3
          ? (i % 2 ? "#142b3b" : "#1b3748")
          : (i % 2 ? "#191523" : "#1b1726");
      ctx.beginPath();
      ctx.roundRect(x, base - gravestoneHeight, gravestoneWidth, gravestoneHeight, [gravestoneWidth / 2, gravestoneWidth / 2, 1, 1]);
      ctx.fill();
      ctx.strokeStyle = `${level.accent}40`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + gravestoneWidth * 0.5, base - gravestoneHeight * 0.72);
      ctx.lineTo(x + gravestoneWidth * 0.5, base - gravestoneHeight * 0.32);
      ctx.moveTo(x + gravestoneWidth * 0.25, base - gravestoneHeight * 0.52);
      ctx.lineTo(x + gravestoneWidth * 0.75, base - gravestoneHeight * 0.52);
      ctx.stroke();
    }

    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const p = (i / 14 + scroll) % 1;
      const y = horizonY + p * p * height * 0.57;
      ctx.strokeStyle = `${level.accent}${Math.round((0.035 + p * 0.1) * 255).toString(16).padStart(2, "0")}`;
      ctx.beginPath();
      ctx.moveTo(width * 0.06, y);
      ctx.lineTo(width * 0.94, y);
      ctx.stroke();
    }
    ctx.restore();

    const fog = ctx.createLinearGradient(0, horizonY - 10, 0, horizonY + 70);
    fog.addColorStop(0, `${level.accent}00`);
    fog.addColorStop(0.5, `${level.accent}1a`);
    fog.addColorStop(1, `${level.accent}00`);
    ctx.fillStyle = fog;
    ctx.fillRect(0, horizonY - 10, width, 80);
  }

  function drawPlayer() {
    const x = player.x * width;
    const y = player.y;
    const pumpkin = pumpkins[selectedPumpkin];
    ctx.save();
    for (const point of player.trail) {
      ctx.globalAlpha = Math.max(0, point.life / 0.35) * 0.25;
      ctx.fillStyle = pumpkin.trail;
      ctx.beginPath();
      ctx.ellipse(point.x, point.y, 3 + point.life * 9, 5 + point.life * 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.translate(x, y);
    ctx.rotate(player.tilt);
    ctx.globalAlpha = invulnerableFor > 0 && Math.floor(performance.now() / 100) % 2 === 0 ? 0.35 : 1;
    ctx.shadowBlur = 28;
    ctx.shadowColor = pumpkin.trail;
    ctx.fillStyle = pumpkin.glow;
    ctx.beginPath();
    ctx.ellipse(0, 2, 24, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 12;
    ctx.fillStyle = pumpkin.color;
    ctx.beginPath();
    ctx.ellipse(0, 1, 16, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = pumpkin.shade;
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * 7, 1, 5, 15, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#62502b";
    ctx.beginPath();
    ctx.ellipse(0, -15, 4, 6, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a1721";
    ctx.beginPath();
    ctx.moveTo(-9, -2);
    ctx.lineTo(-4, -7);
    ctx.lineTo(0, -2);
    ctx.closePath();
    ctx.moveTo(9, -2);
    ctx.lineTo(4, -7);
    ctx.lineTo(0, -2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffe39c";
    ctx.beginPath();
    ctx.moveTo(-6, 6);
    ctx.lineTo(6, 6);
    ctx.lineTo(0, 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = colors.pink;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(-5, 10);
    ctx.lineTo(0, 18 + Math.random() * 5);
    ctx.lineTo(5, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawObjects() {
    for (const object of objects) {
      const x = object.x * width;
      const y = object.y;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(object.rotation);
      ctx.shadowBlur = object.type === "orb" ? 23 : 15;
      ctx.shadowColor = object.color;
      ctx.strokeStyle = object.color;
      ctx.fillStyle = object.type === "orb" ? "rgba(255,220,130,.18)" : "rgba(222,212,255,.16)";
      ctx.lineWidth = object.type === "orb" ? 2 : 1.5;
      if (object.type === "orb") {
        const size = object.size * (1 + Math.sin(performance.now() * 0.006) * 0.08);
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.68, -size * 0.12);
        ctx.lineTo(size * 0.4, size);
        ctx.lineTo(-size * 0.4, size);
        ctx.lineTo(-size * 0.68, -size * 0.12);
        ctx.closePath();
        ctx.fillStyle = "#ffefbd";
        ctx.fill();
        ctx.strokeStyle = "#ff9b35";
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(0, size);
        ctx.strokeStyle = "#f47a22";
        ctx.stroke();
      } else {
        const size = object.size;
        const ghostColor = levels[object.ghostType].ghost;
        ctx.fillStyle = ghostColor;
        ctx.beginPath();
        if (object.ghostType === 1) {
          ctx.moveTo(-size, size * 0.65);
          ctx.lineTo(-size * 0.75, -size * 0.15);
          ctx.lineTo(-size * 0.3, -size * 0.55);
          ctx.lineTo(0, -size * 0.85);
          ctx.lineTo(size * 0.3, -size * 0.55);
          ctx.lineTo(size * 0.75, -size * 0.15);
          ctx.lineTo(size, size * 0.65);
          ctx.lineTo(size * 0.45, size * 0.45);
          ctx.lineTo(0, size * 0.78);
          ctx.lineTo(-size * 0.45, size * 0.45);
        } else if (object.ghostType === 2) {
          ctx.ellipse(0, -size * 0.1, size * 0.82, size * 0.88, 0, 0, Math.PI * 2);
          ctx.moveTo(-size * 0.82, size * 0.2);
          ctx.lineTo(-size * 0.5, size * 0.78);
          ctx.lineTo(-size * 0.18, size * 0.5);
          ctx.lineTo(size * 0.12, size * 0.8);
          ctx.lineTo(size * 0.45, size * 0.48);
          ctx.lineTo(size * 0.82, size * 0.2);
        } else if (object.ghostType === 3) {
          ctx.moveTo(-size * 0.8, size * 0.72);
          ctx.lineTo(-size * 0.65, -size * 0.28);
          ctx.lineTo(-size * 0.22, -size * 0.72);
          ctx.lineTo(0, -size * 1.08);
          ctx.lineTo(size * 0.22, -size * 0.72);
          ctx.lineTo(size * 0.65, -size * 0.28);
          ctx.lineTo(size * 0.8, size * 0.72);
          ctx.lineTo(size * 0.42, size * 0.55);
          ctx.lineTo(0, size * 0.92);
          ctx.lineTo(-size * 0.42, size * 0.55);
        } else {
          ctx.moveTo(-size, size * 0.75);
          ctx.lineTo(-size, -size * 0.15);
          ctx.quadraticCurveTo(-size, -size, 0, -size);
          ctx.quadraticCurveTo(size, -size, size, -size * 0.15);
          ctx.lineTo(size, size * 0.75);
          ctx.lineTo(size * 0.52, size * 0.47);
          ctx.lineTo(0, size * 0.8);
          ctx.lineTo(-size * 0.52, size * 0.47);
        }
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255,255,255,.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-size * 0.52, size * 0.45);
        ctx.lineTo(-size * 0.38, size * 0.69);
        ctx.lineTo(-size * 0.15, size * 0.54);
        ctx.lineTo(0, size * 0.76);
        ctx.lineTo(size * 0.18, size * 0.52);
        ctx.lineTo(size * 0.4, size * 0.68);
        ctx.lineTo(size * 0.54, size * 0.43);
        ctx.stroke();
        ctx.fillStyle = "#392043";
        ctx.beginPath();
        ctx.ellipse(-size * 0.35, -size * 0.1, size * 0.11, size * 0.19, 0, 0, Math.PI * 2);
        ctx.ellipse(size * 0.35, -size * 0.1, size * 0.11, size * 0.19, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = object.color;
        ctx.beginPath();
        ctx.arc(-size * 0.35, -size * 0.1, size * 0.055, 0, Math.PI * 2);
        ctx.arc(size * 0.35, -size * 0.1, size * 0.055, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const particle of particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function draw(time) {
    ctx.save();
    if (shake > 0) {
      const amount = shake * 15;
      ctx.translate((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount);
    }
    drawBackground(time);
    drawObjects();
    drawParticles();
    if (state !== "over") drawPlayer();
    ctx.restore();
  }

  function frame(time) {
    const dt = Math.min((time - (lastFrame || time)) / 1000, 0.04);
    lastFrame = time;
    if (state === "playing") update(dt);
    shake = Math.max(0, shake - dt);
    draw(time);
    requestAnimationFrame(frame);
  }

  function onKeyDown(event) {
    if (["ArrowLeft", "ArrowRight", " ", "a", "A", "d", "D"].includes(event.key)) event.preventDefault();
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") player.targetX = Math.max(0.055, player.targetX - 0.1);
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") player.targetX = Math.min(0.945, player.targetX + 0.1);
    if (event.key === "Escape" || event.key.toLowerCase() === "p") {
      if (state === "playing" || state === "paused") pauseGame();
    }
    if (event.key === " " && state === "ready") startGame();
    else if (event.key === " " && state === "paused") pauseGame();
  }

  playButton.addEventListener("click", () => {
    if (state === "paused") pauseGame();
    else startGame();
  });
  pumpkinChoices.forEach(button => {
    button.addEventListener("click", () => {
      selectedPumpkin = button.dataset.pumpkin;
      pumpkinChoices.forEach(choice => {
        const selected = choice === button;
        choice.classList.toggle("is-selected", selected);
        choice.setAttribute("aria-pressed", String(selected));
      });
    });
  });
  pauseButton.addEventListener("click", () => {
    if (state === "playing" || state === "paused") pauseGame();
  });
  soundButton.addEventListener("click", () => {
    muted = !muted;
    soundButton.classList.toggle("is-muted", muted);
    soundButton.setAttribute("aria-label", muted ? "Turn sound on" : "Turn sound off");
    if (!muted) playTone(520, 0.08, "sine", 0.03);
  });
  ebookCloseButton.addEventListener("click", () => {
    ebookPopup.hidden = true;
  });
  canvas.addEventListener("pointerdown", event => {
    pointerActive = true;
    canvas.setPointerCapture(event.pointerId);
    moveToClientX(event.clientX);
  });
  canvas.addEventListener("pointermove", event => {
    if (pointerActive) moveToClientX(event.clientX);
  });
  canvas.addEventListener("pointerup", () => { pointerActive = false; });
  canvas.addEventListener("pointercancel", () => { pointerActive = false; });
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", resize);
  window.addEventListener("blur", () => {
    if (state === "playing") pauseGame();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "playing") pauseGame();
  });

  setScore(0);
  setCoins(0);
  resize();
  requestAnimationFrame(frame);
})();
