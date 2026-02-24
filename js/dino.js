(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('dino-canvas');
    const scoreP1El = document.getElementById('dino-score-p1');
    const bestP1El = document.getElementById('dino-best-p1');
    const scoreP2El = document.getElementById('dino-score-p2');
    const bestP2El = document.getElementById('dino-best-p2');
    const statusEl = document.getElementById('dino-status');
    const modeInputs = Array.from(document.querySelectorAll('input[name="dino-mode"]'));

    const p2ScoreWrapEl = document.getElementById('dino-p2-score-wrap');
    const p2BestWrapEl = document.getElementById('dino-p2-best-wrap');
    const controlsP1El = document.getElementById('dino-controls-p1');
    const controlsP2El = document.getElementById('dino-controls-p2');
    const controlsRestartEl = document.getElementById('dino-controls-restart');

    const dashCdP1El = document.getElementById('dino-dash-cd-p1');
    const blinkCdP1El = document.getElementById('dino-blink-cd-p1');
    const dashCdP2El = document.getElementById('dino-dash-cd-p2');
    const blinkCdP2El = document.getElementById('dino-blink-cd-p2');
    const swapCdP1El = document.getElementById('dino-swap-cd-p1');
    const swapCdP2El = document.getElementById('dino-swap-cd-p2');
    const dashCdP2WrapEl = document.getElementById('dino-cd-p2-dash-wrap');
    const blinkCdP2WrapEl = document.getElementById('dino-cd-p2-blink-wrap');
    const swapCdP2WrapEl = document.getElementById('dino-cd-p2-swap-wrap');

    const dashCdP1Value = dashCdP1El ? dashCdP1El.querySelector('.dino-cd-value') : null;
    const blinkCdP1Value = blinkCdP1El ? blinkCdP1El.querySelector('.dino-cd-value') : null;
    const dashCdP2Value = dashCdP2El ? dashCdP2El.querySelector('.dino-cd-value') : null;
    const blinkCdP2Value = blinkCdP2El ? blinkCdP2El.querySelector('.dino-cd-value') : null;
    const swapCdP1Value = swapCdP1El ? swapCdP1El.querySelector('.dino-cd-value') : null;
    const swapCdP2Value = swapCdP2El ? swapCdP2El.querySelector('.dino-cd-value') : null;

    if (
      !canvas || !scoreP1El || !bestP1El || !scoreP2El || !bestP2El || !statusEl ||
      !dashCdP1El || !blinkCdP1El || !dashCdP2El || !blinkCdP2El || !swapCdP1El || !swapCdP2El ||
      !dashCdP1Value || !blinkCdP1Value || !dashCdP2Value || !blinkCdP2Value || !swapCdP1Value || !swapCdP2Value ||
      !modeInputs.length || !p2ScoreWrapEl || !p2BestWrapEl || !controlsP1El || !controlsP2El ||
      !controlsRestartEl || !dashCdP2WrapEl || !blinkCdP2WrapEl || !swapCdP2WrapEl
    ) {
      return;
    }

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const config = {
      canvasHeight: 600,
      laneTopY: 70,
      groundHeight: 52,
      baseSpeed: 280,
      maxSpeed: 560,
      speedRamp: 14,
      gravity: 2500,
      initialJumpVelocity: 820,
      jumpHoldThrust: 1200,
      maxJumpHold: 2000,
      metersPerPixel: 0.01,
      dash: {
        boost: 900,
        duration: 0.25,
        cooldown: 1
      },
      blink: {
        distance: 180,
        cooldown: 3,
        effectDuration: 380
      },
      laneSwap: {
        cooldown: 10
      },
      revive: {
        graceMs: 650
      },
      skillCallout: {
        duration: 520,
        floatY: 14
      },
      obstacle: {
        minGap: 320,
        maxGap: 620,
        minWidth: 24,
        maxWidth: 40,
        minHeight: 26,
        maxHeight: 128,
        mapMeters: 10000,
        blinkWallChance: 0.09,
        blinkWallMinSpacing: 2300,
        blinkWallMinWidth: 24,
        blinkWallMaxWidth: 44,
        blinkWallHeight: 300
      },
      catSprite: {
        basePath: '/images/cat/',
        baseName: 'WhiteCat',
        frameSize: 32,
        scale: 2.6,
        runFps: 12,
        hitbox: { x: 5, y: 8, width: 18, height: 16 }
      }
    };

    const viewport = {
      width: canvas.clientWidth || 900,
      height: config.canvasHeight,
      groundYBottom: config.canvasHeight - config.groundHeight,
      groundYTop: config.laneTopY
    };

    const state = {
      frameNow: performance.now(),
      lastFrame: performance.now(),
      isGameOver: false,
      catSprites: null,
      mode: 'dual'
    };

    const lanes = [
      makeLane(0, false, { jump: ['w', 'W'], dash: ['a', 'A'], blink: ['s', 'S'], swap: ['d', 'D'] }, {
        scoreEl: scoreP1El,
        bestEl: bestP1El,
        dashEl: dashCdP1El,
        dashValueEl: dashCdP1Value,
        blinkEl: blinkCdP1El,
        blinkValueEl: blinkCdP1Value
      }),
      makeLane(1, true, { jump: ['i', 'I'], dash: ['j', 'J'], blink: ['k', 'K'], swap: ['l', 'L'] }, {
        scoreEl: scoreP2El,
        bestEl: bestP2El,
        dashEl: dashCdP2El,
        dashValueEl: dashCdP2Value,
        blinkEl: blinkCdP2El,
        blinkValueEl: blinkCdP2Value
      })
    ];

    let dpr = window.devicePixelRatio || 1;

    function makeLane(id, isTopLane, keys, hud) {
      return {
        id,
        name: id === 0 ? 'Simba' : 'Eevee',
        isTopLane,
        gravityDir: isTopLane ? -1 : 1,
        keys,
        hud,
        obstacles: [],
        obstacleCursor: 0,
        rng: mulberry32(1337 + id * 1009),
        blinkEffects: [],
        skillCallout: null,
        deathState: null,
        player: {
          x: 0,
          y: 0,
          width: config.catSprite.frameSize * config.catSprite.scale,
          height: config.catSprite.frameSize * config.catSprite.scale,
          vy: 0,
          isAlive: true,
          isJumping: false,
          isHoldingJump: false,
          jumpStartedAt: 0,
          jumpsUsed: 0,
          maxJumps: 2,
          isDashing: false,
          dashElapsed: 0,
          dashReadyAt: 0,
          blinkReadyAt: 0,
          swapReadyAt: 0,
          invulnerableUntil: 0,
          animTime: 0,
          worldDistance: 0,
          elapsedTime: 0,
          score: 0,
          bestScore: 0
        }
      };
    }

    function mulberry32(seed) {
      let t = seed >>> 0;
      return () => {
        t += 0x6d2b79f5;
        let x = t;
        x = Math.imul(x ^ (x >>> 15), x | 1);
        x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
      };
    }

    function randRange(rng, min, max) {
      return min + rng() * (max - min);
    }

    function hitboxScaled() {
      const hb = config.catSprite.hitbox;
      const k = config.catSprite.scale;
      return {
        x: hb.x * k,
        y: hb.y * k,
        width: hb.width * k,
        height: hb.height * k
      };
    }

    function laneGroundY(lane) {
      return lane.isTopLane ? viewport.groundYTop : viewport.groundYBottom;
    }

    function landingY(lane) {
      const hb = hitboxScaled();
      const groundY = laneGroundY(lane);
      return lane.isTopLane ? groundY - hb.y : groundY - (hb.y + hb.height);
    }

    function playerXByLane(lane) {
      const x = viewport.width * 0.16;
      return Math.min(viewport.width - lane.player.width - 12, x);
    }

    function placePlayerOnLane(lane) {
      lane.player.y = landingY(lane);
    }

    function buildObstacleMap(lane) {
      lane.rng = mulberry32(1337 + lane.id * 1009);
      lane.obstacles = [];
      lane.obstacleCursor = 0;

      const mapPixels = config.obstacle.mapMeters / config.metersPerPixel;
      let x = viewport.width + 220;
      let nextBlinkWallAt = x + 1400;
      while (x < mapPixels + viewport.width + 240) {
        const canPlaceBlinkWall = x >= nextBlinkWallAt;
        const placeBlinkWall = canPlaceBlinkWall && lane.rng() < config.obstacle.blinkWallChance;

        const width = placeBlinkWall
          ? randRange(lane.rng, config.obstacle.blinkWallMinWidth, config.obstacle.blinkWallMaxWidth)
          : randRange(lane.rng, config.obstacle.minWidth, config.obstacle.maxWidth);
        const height = placeBlinkWall
          ? config.obstacle.blinkWallHeight
          : randRange(lane.rng, config.obstacle.minHeight, config.obstacle.maxHeight);

        lane.obstacles.push({
          x,
          y: lane.isTopLane ? laneGroundY(lane) : laneGroundY(lane) - height,
          width,
          height,
          kind: placeBlinkWall ? 'blinkWall' : 'normal'
        });

        x += width + randRange(lane.rng, config.obstacle.minGap, config.obstacle.maxGap);
        if (placeBlinkWall) {
          nextBlinkWallAt = x + config.obstacle.blinkWallMinSpacing;
        }
      }
    }

    function resetLane(lane) {
      const p = lane.player;
      p.x = playerXByLane(lane);
      p.y = landingY(lane);
      p.vy = 0;
      p.isAlive = true;
      p.isJumping = false;
      p.isHoldingJump = false;
      p.jumpStartedAt = 0;
      p.jumpsUsed = 0;
      p.isDashing = false;
      p.dashElapsed = 0;
      p.dashReadyAt = 0;
      p.blinkReadyAt = 0;
      p.swapReadyAt = 0;
      p.invulnerableUntil = 0;
      p.animTime = 0;
      p.worldDistance = 0;
      p.elapsedTime = 0;
      p.score = 0;
      lane.blinkEffects = [];
      lane.skillCallout = null;
      lane.deathState = null;
      buildObstacleMap(lane);
    }

    function resetGame() {
      state.isGameOver = false;
      state.frameNow = performance.now();
      state.lastFrame = state.frameNow;
      lanes[0].isTopLane = false;
      lanes[0].gravityDir = 1;
      lanes[1].isTopLane = true;
      lanes[1].gravityDir = -1;
      lanes.forEach(resetLane);
      if (state.mode === 'single') {
        const p2 = lanes[1].player;
        p2.isAlive = false;
        p2.isJumping = false;
        p2.isHoldingJump = false;
        p2.isDashing = false;
        p2.vy = 0;
      }
      syncAllHud();
      updateCooldownHud(state.frameNow);
      statusEl.textContent = state.mode === 'single' ? 'P1 Running' : 'P1 Running | P2 Running';
    }

    function loadBestScores() {
      try {
        const p1Best = localStorage.getItem('dinoBestScoreP1');
        const p2Best = localStorage.getItem('dinoBestScoreP2');
        if (p1Best) lanes[0].player.bestScore = parseInt(p1Best, 10) || 0;
        if (p2Best) lanes[1].player.bestScore = parseInt(p2Best, 10) || 0;
      } catch (e) {
        // Ignore storage errors.
      }
    }

    function syncLaneHud(lane) {
      lane.hud.scoreEl.textContent = lane.player.score.toString().padStart(5, '0');
      lane.hud.bestEl.textContent = lane.player.bestScore.toString().padStart(5, '0');
    }

    function syncAllHud() {
      lanes.forEach(syncLaneHud);
    }

    function updateRing(el, valueEl, readyAt, cooldownMs, now) {
      if (readyAt === 0) {
        el.dataset.state = 'ready';
        el.style.setProperty('--angle', '360deg');
        valueEl.textContent = `${(cooldownMs / 1000).toFixed(2)}s`;
        return;
      }
      if (now >= readyAt) {
        el.dataset.state = 'ready';
        el.style.setProperty('--angle', '360deg');
        valueEl.textContent = '0.00s';
        return;
      }
      const remaining = Math.max(0, readyAt - now);
      const progress = 1 - Math.min(1, remaining / cooldownMs);
      el.dataset.state = 'cooldown';
      el.style.setProperty('--angle', `${progress * 360}deg`);
      valueEl.textContent = `${(remaining / 1000).toFixed(2)}s`;
    }

    function updateCooldownHud(now) {
      lanes.forEach((lane) => {
        const p = lane.player;
        updateRing(lane.hud.dashEl, lane.hud.dashValueEl, p.dashReadyAt, config.dash.cooldown * 1000, now);
        updateRing(lane.hud.blinkEl, lane.hud.blinkValueEl, p.blinkReadyAt, config.blink.cooldown * 1000, now);
      });
      updateRing(swapCdP1El, swapCdP1Value, lanes[0].player.swapReadyAt, config.laneSwap.cooldown * 1000, now);
      updateRing(swapCdP2El, swapCdP2Value, lanes[1].player.swapReadyAt, config.laneSwap.cooldown * 1000, now);
    }

    function updatePlayerScore(lane) {
      const p = lane.player;
      const meters = p.worldDistance * config.metersPerPixel;
      const time = Math.max(1, p.elapsedTime);
      p.score = Math.max(0, Math.floor((meters * 100) / time));
      if (p.score > p.bestScore) {
        p.bestScore = p.score;
        try {
          localStorage.setItem(`dinoBestScoreP${lane.id + 1}`, String(p.bestScore));
        } catch (e) {
          // Ignore storage errors.
        }
      }
    }

    function startJump(lane, now) {
      const p = lane.player;
      if (state.isGameOver || !p.isAlive || p.jumpsUsed >= p.maxJumps) return;
      p.isJumping = true;
      p.isHoldingJump = true;
      p.jumpStartedAt = now;
      p.vy = -lane.gravityDir * config.initialJumpVelocity;
      p.jumpsUsed += 1;
    }

    function releaseJump(lane) {
      lane.player.isHoldingJump = false;
    }

    function triggerDash(lane, now) {
      const p = lane.player;
      if (state.isGameOver || !p.isAlive || p.isDashing || now < p.dashReadyAt) return;
      p.isDashing = true;
      p.dashElapsed = 0;
      p.dashReadyAt = now + config.dash.cooldown * 1000;
      lane.skillCallout = { text: 'Dash!', start: now, end: now + config.skillCallout.duration };
    }

    function addBlinkEffect(lane, now, centerX, centerY) {
      const half = config.blink.effectDuration / 2;
      lane.blinkEffects.push({ phase: 'in', start: now, end: now + half, x: centerX, y: centerY });
      lane.blinkEffects.push({ phase: 'out', start: now + half, end: now + config.blink.effectDuration, x: centerX, y: centerY });
    }

    function triggerBlink(lane, now) {
      const p = lane.player;
      if (state.isGameOver || !p.isAlive || now < p.blinkReadyAt) return;
      const hb = hitboxScaled();
      const cx = p.x + hb.x + hb.width / 2;
      const cy = p.y + hb.y + hb.height / 2;
      addBlinkEffect(lane, now, cx, cy);
      p.worldDistance += config.blink.distance;
      p.blinkReadyAt = now + config.blink.cooldown * 1000;
      advanceObstacleCursor(lane);
      lane.skillCallout = { text: 'Blink!', start: now, end: now + config.skillCallout.duration };
    }

    function alignLaneToGround(lane) {
      const p = lane.player;
      p.isJumping = false;
      p.isHoldingJump = false;
      p.jumpsUsed = 0;
      p.vy = 0;
      placePlayerOnLane(lane);
    }

    function swapLaneTrackState(laneA, laneB) {
      const obstacles = laneA.obstacles;
      laneA.obstacles = laneB.obstacles;
      laneB.obstacles = obstacles;

      const cursor = laneA.obstacleCursor;
      laneA.obstacleCursor = laneB.obstacleCursor;
      laneB.obstacleCursor = cursor;

      // Track identity is obstacle stream + current world offset.
      const distance = laneA.player.worldDistance;
      laneA.player.worldDistance = laneB.player.worldDistance;
      laneB.player.worldDistance = distance;
    }

    function triggerLaneSwap(casterLane, now) {
      if (state.isGameOver || now < casterLane.player.swapReadyAt) return;
      if (state.mode === 'single') {
        const p1Lane = lanes[0];
        const p2Lane = lanes[1];
        p1Lane.isTopLane = !p1Lane.isTopLane;
        p1Lane.gravityDir = p1Lane.isTopLane ? -1 : 1;
        p2Lane.isTopLane = !p1Lane.isTopLane;
        p2Lane.gravityDir = p2Lane.isTopLane ? -1 : 1;
        swapLaneTrackState(p1Lane, p2Lane);
        alignLaneToGround(p1Lane);
        p1Lane.skillCallout = { text: 'Swap!', start: now, end: now + config.skillCallout.duration };
      } else {
        const p0 = lanes[0].player;
        const p1 = lanes[1].player;
        const s0 = {
          y: p0.y,
          vy: p0.vy,
          isJumping: p0.isJumping,
          isHoldingJump: p0.isHoldingJump,
          jumpsUsed: p0.jumpsUsed,
          jumpStartedAt: p0.jumpStartedAt
        };
        const s1 = {
          y: p1.y,
          vy: p1.vy,
          isJumping: p1.isJumping,
          isHoldingJump: p1.isHoldingJump,
          jumpsUsed: p1.jumpsUsed,
          jumpStartedAt: p1.jumpStartedAt
        };

        lanes[0].isTopLane = !lanes[0].isTopLane;
        lanes[1].isTopLane = !lanes[1].isTopLane;
        lanes[0].gravityDir = lanes[0].isTopLane ? -1 : 1;
        lanes[1].gravityDir = lanes[1].isTopLane ? -1 : 1;
        swapLaneTrackState(lanes[0], lanes[1]);

        p0.y = s1.y;
        p0.vy = s1.vy;
        p0.isJumping = s1.isJumping;
        p0.isHoldingJump = s1.isHoldingJump;
        p0.jumpsUsed = s1.jumpsUsed;
        p0.jumpStartedAt = s1.jumpStartedAt;

        p1.y = s0.y;
        p1.vy = s0.vy;
        p1.isJumping = s0.isJumping;
        p1.isHoldingJump = s0.isHoldingJump;
        p1.jumpsUsed = s0.jumpsUsed;
        p1.jumpStartedAt = s0.jumpStartedAt;

        lanes[0].skillCallout = { text: 'Swap!', start: now, end: now + config.skillCallout.duration };
        lanes[1].skillCallout = { text: 'Swap!', start: now, end: now + config.skillCallout.duration };
      }

      casterLane.player.swapReadyAt = now + config.laneSwap.cooldown * 1000;
    }

    function updateJumpPhysics(lane, dt, now) {
      const p = lane.player;
      if (!p.isAlive) return;

      if (p.isJumping && p.isHoldingJump) {
        const heldMs = now - p.jumpStartedAt;
        if (heldMs <= config.maxJumpHold) {
          p.vy += -lane.gravityDir * config.jumpHoldThrust * dt;
        } else {
          p.isHoldingJump = false;
        }
      }

      p.vy += lane.gravityDir * config.gravity * dt;
      p.y += p.vy * dt;

      const ly = landingY(lane);
      if ((lane.gravityDir > 0 && p.y >= ly) || (lane.gravityDir < 0 && p.y <= ly)) {
        p.y = ly;
        p.vy = 0;
        p.isJumping = false;
        p.isHoldingJump = false;
        p.jumpsUsed = 0;
      }
    }

    function updateDashState(lane, dt) {
      const p = lane.player;
      if (!p.isAlive || !p.isDashing) return;
      p.dashElapsed += dt;
      if (p.dashElapsed >= config.dash.duration) {
        p.isDashing = false;
      }
    }

    function laneSpeed(lane) {
      const p = lane.player;
      const base = Math.min(config.maxSpeed, config.baseSpeed + config.speedRamp * p.elapsedTime);
      return base + (p.isDashing ? config.dash.boost : 0);
    }

    function advanceObstacleCursor(lane) {
      const p = lane.player;
      while (
        lane.obstacleCursor < lane.obstacles.length &&
        lane.obstacles[lane.obstacleCursor].x + lane.obstacles[lane.obstacleCursor].width < p.worldDistance - 120
      ) {
        lane.obstacleCursor += 1;
      }
    }

    function playerHitboxRect(lane) {
      const hb = hitboxScaled();
      const p = lane.player;
      return {
        left: p.x + hb.x,
        right: p.x + hb.x + hb.width,
        top: p.y + hb.y,
        bottom: p.y + hb.y + hb.height,
        width: hb.width,
        height: hb.height
      };
    }

    function hasCollisionWithLane(playerLane, obstacleLane) {
      const p = playerLane.player;
      if (!p.isAlive) return false;
      if (state.frameNow < p.invulnerableUntil) return false;

      const rect = playerHitboxRect(playerLane);
      const playerLeft = rect.left;
      const playerRight = rect.right;
      const playerTop = rect.top;
      const playerBottom = rect.bottom;

      const sourceDistance = obstacleLane.player.worldDistance;
      for (let i = 0; i < obstacleLane.obstacles.length; i += 1) {
        const ob = obstacleLane.obstacles[i];
        const sx = ob.x - sourceDistance;
        if (sx > playerRight + 220) break;
        if (sx + ob.width < playerLeft - 220) continue;

        const overlapX = playerLeft < sx + ob.width && playerRight > sx;
        const overlapY = playerTop < ob.y + ob.height && playerBottom > ob.y;
        if (overlapX && overlapY) {
          return true;
        }
      }
      return false;
    }

    function checkCollision(lane) {
      return lanes.some((sourceLane) => hasCollisionWithLane(lane, sourceLane));
    }

    function killLanePlayer(lane) {
      const p = lane.player;
      if (!p.isAlive) return;
      lane.deathState = {
        y: p.y,
        isJumping: p.isJumping,
        jumpsUsed: p.jumpsUsed
      };
      p.isAlive = false;
      p.isJumping = false;
      p.isHoldingJump = false;
      p.isDashing = false;
      p.vy = 0;
    }

    function reviveLanePlayer(lane, now) {
      const p = lane.player;
      p.isAlive = true;
      p.isJumping = false;
      p.isHoldingJump = false;
      p.jumpsUsed = 0;
      p.isDashing = false;
      p.dashElapsed = 0;
      p.vy = 0;
      if (lane.deathState) {
        p.y = lane.deathState.y;
        p.isJumping = lane.deathState.isJumping;
        p.jumpsUsed = lane.deathState.jumpsUsed;
      } else {
        placePlayerOnLane(lane);
      }
      p.invulnerableUntil = now + config.revive.graceMs;
      lane.skillCallout = { text: 'Revive!', start: now, end: now + config.skillCallout.duration };
    }

    function tryReviveByTouch(now) {
      if (state.mode !== 'dual' || state.isGameOver) return;
      const aliveLanes = lanes.filter((lane) => lane.player.isAlive);
      const deadLanes = lanes.filter((lane) => !lane.player.isAlive);
      if (aliveLanes.length !== 1 || deadLanes.length !== 1) return;

      const aliveLane = aliveLanes[0];
      const deadLane = deadLanes[0];
      const aliveRect = playerHitboxRect(aliveLane);
      const hb = hitboxScaled();
      const reviveLeft = deadLane.player.x + hb.x;
      const reviveRight = reviveLeft + hb.width;
      const reviveTop = deadLane.player.y + hb.y;
      const reviveBottom = reviveTop + hb.height;

      const overlapX = aliveRect.left < reviveRight && aliveRect.right > reviveLeft;
      const overlapY = aliveRect.top < reviveBottom && aliveRect.bottom > reviveTop;
      if (!overlapX || !overlapY) return;

      reviveLanePlayer(deadLane, now);
    }

    function evaluateGameOver() {
      const p1Alive = lanes[0].player.isAlive;
      const p2Alive = lanes[1].player.isAlive;

      if (state.mode === 'single') {
        if (!p1Alive) {
          state.isGameOver = true;
        }
      } else if (!p1Alive && !p2Alive) {
        state.isGameOver = true;
      }

      if (state.isGameOver) {
        statusEl.textContent = state.mode === 'single'
          ? 'P1 down - press R to restart'
          : 'Both down - press R to restart';
        return;
      }

      const p1 = p1Alive ? 'Running' : 'Down';
      if (state.mode === 'single') {
        statusEl.textContent = `P1 ${p1}`;
      } else {
        const p2 = p2Alive ? 'Running' : 'Down';
        statusEl.textContent = `P1 ${p1} | P2 ${p2}`;
      }
    }

    function loadSpriteSheet(src, frameSize) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const frameCount = Math.floor(img.height / frameSize);
          const frames = [];
          for (let i = 0; i < frameCount; i += 1) {
            const off = document.createElement('canvas');
            off.width = frameSize;
            off.height = frameSize;
            const offCtx = off.getContext('2d');
            offCtx.imageSmoothingEnabled = false;
            offCtx.drawImage(img, 0, i * frameSize, frameSize, frameSize, 0, 0, frameSize, frameSize);
            frames.push(off);
          }
          resolve(frames);
        };
        img.onerror = reject;
        img.src = src;
      });
    }

    async function initCatSprites() {
      const { basePath, baseName, frameSize, scale } = config.catSprite;
      const path = (suffix) => `${basePath}${baseName}${suffix}.png`;
      try {
        const [idle, run, dash] = await Promise.all([
          loadSpriteSheet(path('Idle'), frameSize),
          loadSpriteSheet(path('Run'), frameSize),
          loadSpriteSheet(path('Dash'), frameSize)
        ]);

        state.catSprites = {
          frames: {
            run: run.length ? run : idle,
            jump: idle.length ? [idle[0]] : run.slice(0, 1),
            fall: idle.length ? [idle[0]] : run.slice(0, 1),
            dash: dash.length ? dash : run.slice(0, 1)
          },
          size: { width: frameSize * scale, height: frameSize * scale }
        };

        lanes.forEach((lane) => {
          lane.player.width = state.catSprites.size.width;
          lane.player.height = state.catSprites.size.height;
          lane.player.x = playerXByLane(lane);
          if (!lane.player.isJumping) {
            placePlayerOnLane(lane);
          }
        });
      } catch (e) {
        console.warn('Failed to load cat sprites:', e);
      }
    }

    function resizeCanvas() {
      dpr = window.devicePixelRatio || 1;
      viewport.width = Math.min(canvas.parentElement ? canvas.parentElement.clientWidth : canvas.width, 1040) || 900;
      viewport.height = config.canvasHeight;
      viewport.groundYBottom = viewport.height - config.groundHeight;
      viewport.groundYTop = config.laneTopY;

      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      lanes.forEach((lane) => {
        lane.player.x = playerXByLane(lane);
        if (!lane.player.isJumping) placePlayerOnLane(lane);
        buildObstacleMap(lane);
      });
    }

    function drawBackground() {
      ctx.fillStyle = '#f8f8f5';
      ctx.fillRect(0, 0, viewport.width, viewport.height);

      ctx.fillStyle = '#d0d0cb';
      ctx.fillRect(0, viewport.groundYBottom, viewport.width, 2);
      ctx.fillRect(0, viewport.groundYTop, viewport.width, 2);

      ctx.strokeStyle = '#e0e0dc';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(0, viewport.groundYBottom + 16);
      ctx.lineTo(viewport.width, viewport.groundYBottom + 16);
      ctx.moveTo(0, viewport.groundYTop - 16);
      ctx.lineTo(viewport.width, viewport.groundYTop - 16);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    function currentFrame(lane) {
      if (!state.catSprites) return null;
      const p = lane.player;
      let action = 'run';
      if (p.isDashing && p.isAlive) {
        action = 'dash';
      } else if (p.isJumping) {
        action = lane.gravityDir > 0 ? (p.vy < 0 ? 'jump' : 'fall') : (p.vy > 0 ? 'jump' : 'fall');
      }
      const frames = state.catSprites.frames[action] || [];
      if (!frames.length) return null;
      if (action === 'run') {
        return frames[Math.floor(p.animTime * config.catSprite.runFps) % frames.length];
      }
      if (action === 'dash') {
        return frames[Math.floor(p.animTime * (config.catSprite.runFps + 6)) % frames.length];
      }
      return frames[0];
    }

    function getBlinkMorph(lane, now) {
      const fx = lane.blinkEffects.find((item) => now >= item.start && now < item.end);
      if (!fx) return { alpha: 1, scale: 1 };
      const t = Math.max(0, Math.min(1, (now - fx.start) / (fx.end - fx.start)));
      if (fx.phase === 'in') {
        return { alpha: 1 - t * 0.9, scale: 1 - t * 0.6 };
      }
      return { alpha: 0.1 + t * 0.9, scale: 0.4 + t * 0.6 };
    }

    function drawLaneObstacles(lane) {
      for (let i = lane.obstacleCursor; i < lane.obstacles.length; i += 1) {
        const ob = lane.obstacles[i];
        const sx = ob.x - lane.player.worldDistance;
        if (sx > viewport.width + 20) break;
        if (sx + ob.width < -20) continue;

        const isBlinkWall = ob.kind === 'blinkWall';
        ctx.fillStyle = isBlinkWall ? '#111827' : '#5c677d';
        ctx.fillRect(sx, ob.y, ob.width, ob.height);
        ctx.fillStyle = isBlinkWall ? '#3b82f6' : '#748cab';
        ctx.fillRect(
          sx + ob.width * 0.15,
          ob.y + ob.height * 0.15,
          ob.width * 0.7,
          ob.height * 0.7
        );
        if (isBlinkWall) {
          ctx.strokeStyle = '#93c5fd';
          ctx.lineWidth = 2;
          ctx.strokeRect(sx + 2, ob.y + 2, Math.max(0, ob.width - 4), Math.max(0, ob.height - 4));
        }
      }
    }

    function drawLanePlayer(lane) {
      if (state.mode === 'single' && lane.id === 1) {
        return;
      }
      const p = lane.player;
      const frame = currentFrame(lane);
      const morph = getBlinkMorph(lane, state.frameNow);
      const alpha = p.isAlive ? 1 : 0.35;
      const w = p.width * morph.scale;
      const h = p.height * morph.scale;
      const x = p.x + (p.width - w) / 2;
      const y = p.y + (p.height - h) / 2;

      if (frame) {
        ctx.save();
        ctx.globalAlpha = alpha * morph.alpha;
        if (lane.isTopLane) {
          ctx.translate(x + w / 2, y + h / 2);
          ctx.scale(1, -1);
          ctx.drawImage(frame, -w / 2, -h / 2, w, h);
        } else {
          ctx.drawImage(frame, x, y, w, h);
        }
        ctx.restore();
        return;
      }

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#2f3e46';
      ctx.fillRect(p.x, p.y, p.width, p.height);
      ctx.restore();
    }

    function drawLaneName(lane) {
      if (state.mode === 'single' && lane.id === 1) {
        return;
      }
      const p = lane.player;
      const textY = lane.isTopLane ? p.y + p.height + 3 : p.y + 3;
      ctx.save();
      ctx.font = "bold 13px 'Baloo 2', 'Fredoka', 'Comic Sans MS', cursive";
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.shadowColor = 'rgba(0,0,0,0.18)';
      ctx.shadowBlur = 2;
      ctx.fillStyle = lane.id === 0 ? '#2563eb' : '#dc2626';
      ctx.strokeText(lane.name, p.x + p.width / 2, textY);
      ctx.fillText(lane.name, p.x + p.width / 2, textY);
      ctx.restore();
    }

    function drawSkillCallouts(now) {
      lanes.forEach((lane) => {
        if (state.mode === 'single' && lane.id === 1) {
          return;
        }
        const callout = lane.skillCallout;
        if (!callout || now >= callout.end) {
          lane.skillCallout = null;
          return;
        }

        const p = lane.player;
        const t = Math.max(0, Math.min(1, (now - callout.start) / (callout.end - callout.start)));
        const alpha = 1 - t * 0.35;
        const floatOffset = t * config.skillCallout.floatY;
        const bubbleX = p.x + p.width + 20;
        const bubbleY = p.y + p.height * 0.28 - floatOffset;
        const bubbleW = 56;
        const bubbleH = 22;
        const radius = 8;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 2.4;

        ctx.beginPath();
        ctx.moveTo(bubbleX + radius, bubbleY);
        ctx.lineTo(bubbleX + bubbleW - radius, bubbleY);
        ctx.quadraticCurveTo(bubbleX + bubbleW, bubbleY, bubbleX + bubbleW, bubbleY + radius);
        ctx.lineTo(bubbleX + bubbleW, bubbleY + bubbleH - radius);
        ctx.quadraticCurveTo(bubbleX + bubbleW, bubbleY + bubbleH, bubbleX + bubbleW - radius, bubbleY + bubbleH);
        ctx.lineTo(bubbleX + radius, bubbleY + bubbleH);
        ctx.quadraticCurveTo(bubbleX, bubbleY + bubbleH, bubbleX, bubbleY + bubbleH - radius);
        ctx.lineTo(bubbleX, bubbleY + radius);
        ctx.quadraticCurveTo(bubbleX, bubbleY, bubbleX + radius, bubbleY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(bubbleX, bubbleY + bubbleH * 0.55);
        ctx.lineTo(bubbleX - 10, bubbleY + bubbleH * 0.68);
        ctx.lineTo(bubbleX, bubbleY + bubbleH * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#111111';
        ctx.font = "bold 11px 'Baloo 2', 'Fredoka', 'Comic Sans MS', cursive";
        ctx.textAlign = 'center';
        ctx.fillText(callout.text, bubbleX + bubbleW / 2, bubbleY + 15);
        ctx.restore();
      });
    }

    function drawBlinkEffects(now) {
      lanes.forEach((lane) => {
        lane.blinkEffects = lane.blinkEffects.filter((fx) => now < fx.end);
        lane.blinkEffects.forEach((fx) => {
          const t = Math.max(0, Math.min(1, (now - fx.start) / (fx.end - fx.start)));
          const rBase = 30;
          const r = fx.phase === 'in' ? rBase * (1 - t) : rBase * t;
          const spin = (fx.phase === 'in' ? 1 : -1) * (t * Math.PI * 3);

          ctx.save();
          ctx.translate(fx.x, fx.y);
          ctx.rotate(spin);
          const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
          g.addColorStop(0, 'rgba(4,4,10,0.96)');
          g.addColorStop(0.5, 'rgba(20,20,35,0.7)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = 'rgba(120,140,255,0.35)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.8, 0.2, Math.PI * 1.7);
          ctx.stroke();
          ctx.restore();
        });
      });
    }

    function drawDistanceAndTime() {
      const p1 = lanes[0].player;
      const p2 = lanes[1].player;
      const y = Math.min(viewport.height - 30, viewport.groundYBottom + 28);

      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.font = '13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        `P1 ${(p1.worldDistance * config.metersPerPixel).toFixed(1)} m / ${p1.elapsedTime.toFixed(1)} s`,
        viewport.width / 2,
        y
      );
      if (state.mode !== 'single') {
        ctx.fillText(
          `P2 ${(p2.worldDistance * config.metersPerPixel).toFixed(1)} m / ${p2.elapsedTime.toFixed(1)} s`,
          viewport.width / 2,
          y + 14
        );
      }
      ctx.restore();
    }

    function drawGameOver() {
      if (!state.isGameOver) return;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, viewport.width, viewport.height);
      ctx.fillStyle = '#fff';
      ctx.font = '18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Game Over - Press R to restart', viewport.width / 2, viewport.height / 2);
      ctx.restore();
    }

    function updateLane(lane, dt, now) {
      const p = lane.player;
      // Keep lane scrolling even after death so the track still feels alive.
      p.worldDistance += laneSpeed(lane) * dt;
      advanceObstacleCursor(lane);

      if (!p.isAlive) return;

      updateJumpPhysics(lane, dt, now);
      updateDashState(lane, dt);
      p.elapsedTime += dt;
      p.animTime += dt;

      if (checkCollision(lane)) {
        killLanePlayer(lane);
      }
      updatePlayerScore(lane);
    }

    function step(now) {
      state.frameNow = now;
      const dt = Math.min(now - state.lastFrame, 32) / 1000;
      state.lastFrame = now;

      if (!state.isGameOver) {
        lanes.forEach((lane) => updateLane(lane, dt, now));
        tryReviveByTouch(now);
        evaluateGameOver();
      }

      drawBackground();
      lanes.forEach(drawLaneObstacles);
      drawBlinkEffects(now);
      lanes.forEach(drawLanePlayer);
      lanes.forEach(drawLaneName);
      drawSkillCallouts(now);
      drawDistanceAndTime();
      drawGameOver();
      updateCooldownHud(now);
      syncAllHud();

      requestAnimationFrame(step);
    }

    function handleKeyDown(event) {
      const key = event.key;
      const now = performance.now();

      const maybeAction = (lane) => {
        if (lane.keys.jump.includes(key)) {
          event.preventDefault();
          startJump(lane, now);
          return true;
        }
        if (lane.keys.dash.includes(key)) {
          triggerDash(lane, now);
          return true;
        }
        if (lane.keys.blink.includes(key)) {
          triggerBlink(lane, now);
          return true;
        }
        if (lane.keys.swap.includes(key)) {
          triggerLaneSwap(lane, now);
          return true;
        }
        return false;
      };

      if (maybeAction(lanes[0])) {
        return;
      }
      if (state.mode !== 'single' && maybeAction(lanes[1])) {
        return;
      }

      if ((key === 'r' || key === 'R') && state.isGameOver) {
        resetGame();
      }
    }

    function handleKeyUp(event) {
      const key = event.key;
      if (lanes[0].keys.jump.includes(key)) {
        releaseJump(lanes[0]);
      } else if (state.mode !== 'single' && lanes[1].keys.jump.includes(key)) {
        releaseJump(lanes[1]);
      }
    }

    function applyModeUi() {
      const isSingle = state.mode === 'single';
      p2ScoreWrapEl.style.display = isSingle ? 'none' : '';
      p2BestWrapEl.style.display = isSingle ? 'none' : '';
      controlsP1El.style.display = '';
      controlsP2El.style.display = isSingle ? 'none' : '';
      controlsRestartEl.textContent = isSingle
        ? 'R: Restart'
        : 'R: Restart (when both down)';
      dashCdP2WrapEl.style.display = isSingle ? 'none' : '';
      blinkCdP2WrapEl.style.display = isSingle ? 'none' : '';
      swapCdP2WrapEl.style.display = isSingle ? 'none' : '';
    }

    function setMode(mode, shouldReset) {
      state.mode = mode === 'single' ? 'single' : 'dual';
      modeInputs.forEach((input) => {
        input.checked = input.value === state.mode;
      });
      applyModeUi();
      if (shouldReset) {
        resetGame();
      }
    }

    window.addEventListener('resize', resizeCanvas);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    modeInputs.forEach((input) => {
      input.addEventListener('change', () => {
        if (input.checked) {
          setMode(input.value, true);
        }
      });
    });

    loadBestScores();
    initCatSprites();
    const defaultMode = modeInputs.find((input) => input.checked)?.value || 'dual';
    setMode(defaultMode, false);
    resizeCanvas();
    resetGame();
    requestAnimationFrame(step);
  });
})();
