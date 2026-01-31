(() => {
  // ----------------------------
  // Footer: drag hand anywhere + bubble rate limit + prevent text selection
  // ----------------------------
  const hand = document.getElementById("dragHand");
  const bubbleLayer = document.getElementById("bubbleLayer");
  const hills = document.getElementById("hills");

  // ----------------------------
  // Intro: floating skills bubbles w/ collision
  // ----------------------------
  const skillsBox = document.getElementById("skillsBubbles");

  // ---------- helpers ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // hill hit-test: only emit 🥰 when pointer is over the SVG hill paths
  function isOnHill(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    return el && el.classList && el.classList.contains("hill-layer");
  }

  // ---------- bubble spawn ----------
  function spawnBubbleAt(clientX, clientY) {
    if (!bubbleLayer || !hills) return;

    const rect = hills.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const b = document.createElement("div");
    b.className = "bubble";
    b.textContent = "🥰";
    b.style.left = `${x}px`;
    b.style.top = `${y}px`;
    bubbleLayer.appendChild(b);

    b.addEventListener("animationend", () => b.remove());
  }

  // ---------- drag logic ----------
  if (hand) {
    let dragging = false;
    let pointerId = null;

    let lastT = 0;
    let lastX = 0;
    let lastY = 0;
    let lastV = 0; // speed px/s

    let lastBubbleTime = 0;
    const BUBBLE_COOLDOWN_MS = 420; // 0.42 seconds once

    // keep layout stable while hand is "pulled out" to fixed positioning
    const placeholder = document.createElement("span");
    placeholder.style.display = "inline-block";
    placeholder.style.width = "34px";
    placeholder.style.height = "34px";

    const originalParent = hand.parentElement;

    function setHandFloating(on) {
      if (on) {
        document.body.classList.add("dragging-hand");
        hand.classList.add("is-floating");
        // swap into body so it can go anywhere
        if (originalParent && hand.parentElement === originalParent) {
          originalParent.insertBefore(placeholder, hand);
          document.body.appendChild(hand);
        }
      } else {
        document.body.classList.remove("dragging-hand");
        hand.classList.remove("is-floating");
        hand.style.transform = "";
        hand.style.boxShadow = "";
        hand.style.borderColor = "";

        // restore into footer pill
        if (originalParent && placeholder.parentElement === originalParent) {
          originalParent.insertBefore(hand, placeholder);
          placeholder.remove();
        }
      }
    }

    function updateHandPosition(clientX, clientY) {
      // center the emoji a bit under pointer
      const tx = clientX - 16;
      const ty = clientY - 16;
      hand.style.transform = `translate(${tx}px, ${ty}px)`;
      hand.style.boxShadow = `0 10px 22px rgba(0,0,0,0.10)`;
      hand.style.borderColor = `rgba(16,19,25,0.16)`;
    }

    function onPointerDown(e) {
      dragging = true;
      pointerId = e.pointerId;

      hand.setPointerCapture(pointerId);
      setHandFloating(true);

      const now = performance.now();
      lastT = now;
      lastX = e.clientX;
      lastY = e.clientY;
      lastV = 0;
      lastBubbleTime = 0;

      updateHandPosition(e.clientX, e.clientY);
    }

    function onPointerMove(e) {
      if (!dragging || e.pointerId !== pointerId) return;

      const now = performance.now();
      const dt = Math.max(1, now - lastT) / 1000;

      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;

      const v = Math.sqrt(dx * dx + dy * dy) / dt;
      const a = Math.abs(v - lastV) / dt;

      updateHandPosition(e.clientX, e.clientY);

      // bubble condition: on hill + acceleration threshold + cooldown
      if (isOnHill(e.clientX, e.clientY) && a > 600) {
        if (now - lastBubbleTime >= BUBBLE_COOLDOWN_MS) {
          spawnBubbleAt(e.clientX, e.clientY);
          lastBubbleTime = now;
        }
      }

      lastT = now;
      lastX = e.clientX;
      lastY = e.clientY;
      lastV = v;
    }

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;

      try {
        if (pointerId != null) hand.releasePointerCapture(pointerId);
      } catch {}
      pointerId = null;

      setHandFloating(false);
    }

    hand.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  }

  // ----------------------------
  // Skills bubbles: collision + free floating inside column
  // ----------------------------
  if (skillsBox) {
    const words = [
      "Python",
      "R",
      "Web Development",
      "NCBI",
      "BLAST",
      "Galaxy",
      "Wet-lab"
    ];

    const items = [];
    const rand = (a, b) => a + Math.random() * (b - a);

    // create DOM nodes
    for (const w of words) {
      const el = document.createElement("div");
      el.className = "skill-bubble";
      el.textContent = w;
      skillsBox.appendChild(el);
      items.push({
        el,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        r: 22 // will be refined after measuring
      });
    }

    function measureAndInit() {
      const rect = skillsBox.getBoundingClientRect();

      for (const it of items) {
        const b = it.el.getBoundingClientRect();
        // approximate radius from size (pill-ish)
        const r = Math.max(b.width, b.height) * 0.5;
        it.r = clamp(r, 18, 60);

        it.x = rand(it.r, rect.width - it.r);
        it.y = rand(it.r, rect.height - it.r);

        const speed = rand(18, 42);
        const ang = rand(0, Math.PI * 2);
        it.vx = Math.cos(ang) * speed;
        it.vy = Math.sin(ang) * speed;

        it.el.style.left = `${it.x}px`;
        it.el.style.top = `${it.y}px`;
      }
    }

    // basic elastic collision (same mass)
    function resolveCollision(a, b) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
      const minDist = a.r + b.r;

      if (dist >= minDist) return;

      // push apart
      const overlap = (minDist - dist) * 0.5;
      const nx = dx / dist;
      const ny = dy / dist;

      a.x -= nx * overlap;
      a.y -= ny * overlap;
      b.x += nx * overlap;
      b.y += ny * overlap;

      // swap velocity components along the normal (simple & stable)
      const avn = a.vx * nx + a.vy * ny;
      const bvn = b.vx * nx + b.vy * ny;

      const dvn = bvn - avn;
      a.vx += dvn * nx;
      a.vy += dvn * ny;
      b.vx -= dvn * nx;
      b.vy -= dvn * ny;
    }

    let last = performance.now();

    function tick(now) {
      const rect = skillsBox.getBoundingClientRect();
      const dt = clamp((now - last) / 1000, 0, 0.03);
      last = now;

      // move
      for (const it of items) {
        it.x += it.vx * dt;
        it.y += it.vy * dt;

        // wall bounce
        if (it.x < it.r) { it.x = it.r; it.vx *= -1; }
        if (it.x > rect.width - it.r) { it.x = rect.width - it.r; it.vx *= -1; }
        if (it.y < it.r) { it.y = it.r; it.vy *= -1; }
        if (it.y > rect.height - it.r) { it.y = rect.height - it.r; it.vy *= -1; }

        // slight damping keeps it chill
        it.vx *= 0.999;
        it.vy *= 0.999;
      }

      // collisions (O(n^2) but n is small)
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          resolveCollision(items[i], items[j]);
        }
      }

      // render
      for (const it of items) {
        it.el.style.left = `${it.x}px`;
        it.el.style.top = `${it.y}px`;
      }

      requestAnimationFrame(tick);
    }

    // init after layout is ready
    const start = () => {
      measureAndInit();
      last = performance.now();
      requestAnimationFrame(tick);
    };

    if (document.readyState === "complete" || document.readyState === "interactive") {
      start();
    } else {
      window.addEventListener("DOMContentLoaded", start, { once: true });
    }

    // re-init on resize (keeps bounds correct)
    window.addEventListener("resize", () => {
      measureAndInit();
    });
  }
})();
