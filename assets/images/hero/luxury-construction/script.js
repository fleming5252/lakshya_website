/* ==========================================================================
   Anchor & Vale — Construction Frame Sequence Engine
   Vanilla JS. No dependencies. No CDN.

   Responsibilities:
   1. Discover & lazily load an image sequence (frames/frame_0001.jpg ...)
   2. Preload an initial buffer, then stream the rest in priority order
      (nearest to the current playhead first) using idle time.
   3. Play the sequence once, start to finish, via requestAnimationFrame,
      using a time accumulator so playback speed is independent of the
      monitor's refresh rate.
   4. Never show a blank / half-loaded frame: the canvas only advances to
      frames that are already fully decoded and cached. If playback
      catches up to the edge of what is loaded, it holds the last good
      frame rather than flickering.
   5. Pause when the section leaves the viewport or the tab is hidden,
      resume exactly where it left off.
   6. Respect prefers-reduced-motion by jumping straight to the final,
      completed-house frame with no animated playback.
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* Configuration                                                       */
  /* ------------------------------------------------------------------ */

  var CONFIG = {
    framePath: "frames/",
    framePrefix: "frame_",
    frameExtension: ".jpg",
    frameDigits: 4,          // frame_0001.jpg
    totalFrames: 302,        // frame_0001.jpg ... frame_0302.jpg
    durationMs: 8000,        // total play-through time, start to finish
    initialBufferFrames: 24, // frames guaranteed loaded before playback can start
    idleChunkSize: 6,        // frames fetched per idle background batch
    warmFromProgress: 0.62,  // fraction of the build where lighting turns warm
    fallbackDigitsTried: [4, 3, 2] // in case the folder uses fewer digits
  };

  /* ------------------------------------------------------------------ */
  /* DOM references                                                      */
  /* ------------------------------------------------------------------ */

  var section = document.getElementById("buildSection");
  var stage = document.getElementById("stage");
  var canvas = document.getElementById("buildCanvas");
  var loader = document.getElementById("loader");
  var loaderPct = document.getElementById("loaderPct");
  var progressFill = document.getElementById("progressFill");

  if (!section || !canvas) return;

  var ctx = canvas.getContext("2d", { alpha: false });

  var reducedMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------ */
  /* State                                                               */
  /* ------------------------------------------------------------------ */

  var cache = new Array(CONFIG.totalFrames + 1); // index 1..totalFrames -> HTMLImageElement|undefined
  var loadedCount = 0;
  var highestContiguousLoaded = 0; // frames 1..N loaded with no gaps
  var digitPattern = CONFIG.frameDigits;

  var currentFrame = 1;
  var elapsed = 0;             // ms of playback consumed
  var isPlaying = false;
  var hasFinished = false;
  var isSectionVisible = false;
  var isTabVisible = document.visibilityState !== "hidden";
  var rafId = null;
  var lastTimestamp = null;
  var readyToStart = false;
  var backgroundLoadStarted = false;

  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  /* ------------------------------------------------------------------ */
  /* Frame URL helper                                                    */
  /* ------------------------------------------------------------------ */

  function pad(num, digits) {
    var s = String(num);
    while (s.length < digits) s = "0" + s;
    return s;
  }

  function frameUrl(index) {
    return CONFIG.framePath + CONFIG.framePrefix + pad(index, digitPattern) + CONFIG.frameExtension;
  }

  /* ------------------------------------------------------------------ */
  /* Loading                                                             */
  /* ------------------------------------------------------------------ */

  function loadFrame(index, onDone) {
    if (index < 1 || index > CONFIG.totalFrames) { if (onDone) onDone(); return; }
    if (cache[index]) { if (onDone) onDone(); return; }

    var img = new Image();
    img.decoding = "async";
    img.onload = function () {
      cache[index] = img;
      loadedCount++;
      recalcContiguous();
      updateLoaderProgress();
      if (onDone) onDone();
    };
    img.onerror = function () {
      // Mark as failed-but-attempted so we don't block progress forever.
      cache[index] = null;
      if (onDone) onDone();
    };
    img.src = frameUrl(index);
  }

  function recalcContiguous() {
    var i = highestContiguousLoaded + 1;
    while (i <= CONFIG.totalFrames && cache[i] !== undefined) {
      highestContiguousLoaded = i;
      i++;
    }
  }

  function updateLoaderProgress() {
    var pct = Math.min(100, Math.round((loadedCount / CONFIG.totalFrames) * 100));
    if (loaderPct) loaderPct.textContent = pct + "%";
  }

  // Load the first N frames in parallel-ish (a handful at a time) so the
  // very first paint is fast, then hand off to background streaming.
  function loadInitialBuffer(done) {
    var target = Math.min(CONFIG.initialBufferFrames, CONFIG.totalFrames);
    var remaining = target;
    if (remaining === 0) { done(); return; }

    var concurrency = 6;
    var nextIndex = 1;

    function kick() {
      if (nextIndex > target) return;
      var idx = nextIndex++;
      loadFrame(idx, function () {
        remaining--;
        if (remaining <= 0) {
          done();
        } else {
          kick();
        }
      });
    }

    for (var c = 0; c < concurrency; c++) kick();
  }

  // Stream the remaining frames during idle time, prioritised so frames
  // just ahead of the current playhead arrive before ones far behind.
  function startBackgroundLoading() {
    if (backgroundLoadStarted) return;
    backgroundLoadStarted = true;

    var idle = window.requestIdleCallback || function (cb) {
      return setTimeout(function () { cb({ timeRemaining: function () { return 8; } }); }, 120);
    };

    function pickNextBatch() {
      var batch = [];
      var start = Math.max(1, currentFrame);

      // Ahead-first sweep from the current playhead to the end.
      for (var i = start; i <= CONFIG.totalFrames && batch.length < CONFIG.idleChunkSize; i++) {
        if (cache[i] === undefined) batch.push(i);
      }
      // Then fill any earlier gaps (e.g. left over from an interrupted load).
      if (batch.length < CONFIG.idleChunkSize) {
        for (var j = 1; j < start && batch.length < CONFIG.idleChunkSize; j++) {
          if (cache[j] === undefined) batch.push(j);
        }
      }
      return batch;
    }

    function step() {
      var batch = pickNextBatch();
      if (batch.length === 0) return; // fully loaded

      var remaining = batch.length;
      batch.forEach(function (idx) {
        loadFrame(idx, function () {
          remaining--;
          if (remaining === 0) idle(step);
        });
      });
    }

    idle(step);
  }

  /* ------------------------------------------------------------------ */
  /* Canvas drawing (manual "object-fit: cover")                         */
  /* ------------------------------------------------------------------ */

  function sizeCanvasToDisplay() {
    var rect = canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(rect.width * dpr));
    var h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function drawFrame(index) {
    var img = cache[index];
    if (!img) return false;

    sizeCanvasToDisplay();

    var cw = canvas.width, ch = canvas.height;
    var iw = img.naturalWidth, ih = img.naturalHeight;
    var canvasRatio = cw / ch;
    var imgRatio = iw / ih;

    var sx, sy, sw, sh;
    if (imgRatio > canvasRatio) {
      // image wider than canvas -> crop sides
      sh = ih;
      sw = ih * canvasRatio;
      sx = (iw - sw) / 2;
      sy = 0;
    } else {
      // image taller than canvas -> crop top/bottom
      sw = iw;
      sh = iw / canvasRatio;
      sx = 0;
      sy = (ih - sh) / 2;
    }

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Lighting / progress side-effects                                    */
  /* ------------------------------------------------------------------ */

  function applyProgressEffects(progress) {
    if (progressFill) progressFill.style.width = (progress * 100).toFixed(1) + "%";
    if (stage) {
      if (progress >= CONFIG.warmFromProgress) {
        stage.classList.add("stage--warm");
      } else {
        stage.classList.remove("stage--warm");
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Playback loop                                                       */
  /* ------------------------------------------------------------------ */

  function targetFrameForElapsed(ms) {
    var progress = Math.min(1, ms / CONFIG.durationMs);
    var frame = 1 + Math.round(progress * (CONFIG.totalFrames - 1));
    return { frame: frame, progress: progress };
  }

  function tick(timestamp) {
    if (!isPlaying) return;

    if (lastTimestamp === null) lastTimestamp = timestamp;
    var delta = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    // Guard against huge deltas (tab was backgrounded, debugger paused, etc.)
    if (delta > 250) delta = 16.7;

    elapsed += delta;

    var target = targetFrameForElapsed(elapsed);
    var desiredFrame = target.frame;

    // Never jump to a frame that isn't loaded yet — hold position instead
    // of flickering to a blank canvas. This gracefully self-corrects once
    // the loader catches up.
    var frameToShow = Math.min(desiredFrame, Math.max(1, highestContiguousLoaded));

    if (frameToShow !== currentFrame || !canvas.classList.contains("is-ready")) {
      var drew = drawFrame(frameToShow);
      if (drew) {
        currentFrame = frameToShow;
        canvas.classList.add("is-ready");
      }
    }

    applyProgressEffects(Math.max(target.progress, currentFrame / CONFIG.totalFrames));

    if (target.progress >= 1 && currentFrame >= CONFIG.totalFrames) {
      hasFinished = true;
      stopLoop();
      return;
    }

    rafId = requestAnimationFrame(tick);
  }

  function startLoop() {
    if (isPlaying || hasFinished || !readyToStart) return;
    if (!isSectionVisible || !isTabVisible) return;
    isPlaying = true;
    lastTimestamp = null;
    rafId = requestAnimationFrame(tick);
  }

  function stopLoop() {
    isPlaying = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Reduced motion path                                                 */
  /* ------------------------------------------------------------------ */

  function showFinalFrameImmediately() {
    loadFrame(CONFIG.totalFrames, function () {
      highestContiguousLoaded = CONFIG.totalFrames; // allow draw regardless of gaps
      drawFrame(CONFIG.totalFrames);
      currentFrame = CONFIG.totalFrames;
      canvas.classList.add("is-ready");
      applyProgressEffects(1);
      hasFinished = true;
      hideLoader();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Loader visibility                                                   */
  /* ------------------------------------------------------------------ */

  function hideLoader() {
    if (!loader) return;
    loader.style.opacity = "0";
    loader.setAttribute("hidden", "");
  }

  /* ------------------------------------------------------------------ */
  /* Visibility: viewport (IntersectionObserver) + tab                   */
  /* ------------------------------------------------------------------ */

  function setupVisibilityObservers() {
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          isSectionVisible = entry.isIntersecting;
          if (isSectionVisible) {
            section.classList.add("in-view");
            startLoop();
          } else {
            stopLoop();
          }
        });
      }, { threshold: 0.2 });
      io.observe(section);
    } else {
      // Fallback: assume visible.
      isSectionVisible = true;
      section.classList.add("in-view");
    }

    document.addEventListener("visibilitychange", function () {
      isTabVisible = document.visibilityState !== "hidden";
      if (isTabVisible) {
        startLoop();
      } else {
        stopLoop();
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Resize                                                              */
  /* ------------------------------------------------------------------ */

  function setupResize() {
    var resizeTimer = null;
    window.addEventListener("resize", function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        drawFrame(currentFrame);
      }, 120);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Frame-count / digit-width auto-detection                            */
  /* ------------------------------------------------------------------ */

  // Attempts frame_0001.jpg style first (per the project brief). If the
  // very first frame 404s, retries with fewer zero-padded digits so the
  // sequence still works if the frames folder was exported differently.
  function detectDigitPatternThenInit() {
    var attempts = CONFIG.fallbackDigitsTried.slice();

    function tryNext() {
      if (attempts.length === 0) {
        // Give up gracefully: still reveal the section content.
        hideLoader();
        section.classList.add("in-view");
        return;
      }
      var digits = attempts.shift();
      var probe = new Image();
      probe.onload = function () {
        digitPattern = digits;
        cache[1] = probe;
        loadedCount = 1;
        highestContiguousLoaded = 1;
        init();
      };
      probe.onerror = tryNext;
      probe.src = CONFIG.framePath + CONFIG.framePrefix + pad(1, digits) + CONFIG.frameExtension;
    }

    tryNext();
  }

  /* ------------------------------------------------------------------ */
  /* Init                                                                 */
  /* ------------------------------------------------------------------ */

  function init() {
    setupVisibilityObservers();
    setupResize();

    if (reducedMotion) {
      showFinalFrameImmediately();
      section.classList.add("in-view");
      return;
    }

    loadInitialBuffer(function () {
      readyToStart = true;
      hideLoader();
      drawFrame(1);
      canvas.classList.add("is-ready");
      startBackgroundLoading();
      startLoop();
    });
  }

  detectDigitPatternThenInit();
})();
