(function () {
  var canvas = document.getElementById('stage');
  var ctx = canvas.getContext('2d');
  var scoreEl = document.getElementById('score');
  var hintEl = document.getElementById('hint');
  var ctaBtn = document.getElementById('cta');

  var width = 390;
  var height = 844;
  var score = 0;
  var targetScore = 3;
  var paused = false;
  var ended = false;
  var coins = [];
  var audioCtx = null;

  function playPopSound() {
    if (window.playable && window.playable.isMuted()) return;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520 + score * 90, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.14);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (_) {
      // Ignore audio failures in headless/restricted WebViews
    }
  }

  function spawnCoins() {
    coins = [];
    var r = Math.max(24, Math.min(width, height) * 0.085);
    for (var i = 0; i < 3; i++) {
      coins.push({
        x: width * (0.25 + i * 0.25),
        y: height * (0.42 + (i % 2) * 0.12),
        r: r,
        phase: i * 1.4,
        collected: false
      });
    }
  }

  function resize() {
    width = window.innerWidth || 390;
    height = window.innerHeight || 844;
    canvas.width = width;
    canvas.height = height;
    if (coins.length === 0) {
      spawnCoins();
    } else {
      var r = Math.max(24, Math.min(width, height) * 0.085);
      for (var i = 0; i < coins.length; i++) {
        coins[i].x = width * (0.25 + i * 0.25);
        coins[i].y = height * (0.42 + (i % 2) * 0.12);
        coins[i].r = r;
      }
    }
    render(0);
  }

  function render(t) {
    var grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#102542');
    grad.addColorStop(1, '#1f4068');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    for (var i = 0; i < coins.length; i++) {
      var c = coins[i];
      if (c.collected) continue;
      var bob = Math.sin(t * 0.004 + c.phase) * 8;
      ctx.beginPath();
      ctx.arc(c.x, c.y + bob, c.r, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd166';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#f4a261';
      ctx.stroke();

      ctx.fillStyle = '#7f4f24';
      ctx.font = 'bold ' + Math.round(c.r * 0.9) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', c.x, c.y + bob + 2);
    }
  }

  function loop(t) {
    if (!paused) {
      render(t);
    }
    window.requestAnimationFrame(loop);
  }

  canvas.addEventListener('pointerdown', function (ev) {
    var rect = canvas.getBoundingClientRect();
    var px = ev.clientX - rect.left;
    var py = ev.clientY - rect.top;

    for (var i = 0; i < coins.length; i++) {
      var c = coins[i];
      if (c.collected) continue;
      var dx = px - c.x;
      var dy = py - c.y;
      if (dx * dx + dy * dy <= c.r * c.r * 1.4) {
        c.collected = true;
        score += 1;
        playPopSound();
        scoreEl.textContent = 'Coins: ' + score + ' / ' + targetScore;
        if (score >= targetScore && !ended) {
          ended = true;
          hintEl.textContent = 'Awesome! Tap Install Now!';
          if (window.playable) window.playable.gameEnd();
        }
        break;
      }
    }
  });

  ctaBtn.addEventListener('click', function () {
    playPopSound();
    if (!ended) {
      ended = true;
      if (window.playable) window.playable.gameEnd();
    }
    if (window.playable) window.playable.cta();
  });

  function start() {
    resize();
    if (window.playable) window.playable.ready();
    window.requestAnimationFrame(loop);
  }

  if (window.playable) {
    window.playable.init({
      onStart: start,
      onPause: function () { paused = true; },
      onResume: function () { paused = false; },
      onResize: resize
    });
  } else {
    window.addEventListener('resize', resize);
    start();
  }
})();
