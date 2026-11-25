const langBtn = document.getElementById("langBtn");
const bgMusic = document.getElementById("bgMusic");

const whishCopyBtn = document.getElementById("whishCopyBtn");
const whishMsg = document.getElementById("whishMsg");

const startBtn = document.getElementById("startBtn");
const startScreen = document.getElementById("startScreen");

const envelope = document.getElementById("envelope");
const sealBtn = document.querySelector(".sealBtn");
const musicBtn = document.getElementById("musicBtn");

// localStorage can throw (private mode, blocked storage) — never let that break the page
function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

function updateMusicBtn() {
  if (!musicBtn || !bgMusic) return;
  const audible = !bgMusic.paused && !bgMusic.muted;
  musicBtn.textContent = audible ? "🔊 Music" : "🔇 Music";
}

function playMusic() {
  if (!bgMusic) return;
  bgMusic.play().then(updateMusicBtn).catch(updateMusicBtn);
}

// Restore previous choice
if (bgMusic) {
  bgMusic.muted = storageGet("musicMuted") === "1";
  bgMusic.addEventListener("play", updateMusicBtn);
  bgMusic.addEventListener("pause", updateMusicBtn);
  bgMusic.addEventListener("volumechange", updateMusicBtn);
}
updateMusicBtn();

musicBtn?.addEventListener("click", () => {
  if (!bgMusic) return;

  if (bgMusic.paused || bgMusic.muted) {
    // Not audible: unmute and make sure it is actually playing (this click is a user gesture)
    bgMusic.muted = false;
    if (bgMusic.paused) playMusic();
  } else {
    bgMusic.muted = true;
  }

  storageSet("musicMuted", bgMusic.muted ? "1" : "0");
  updateMusicBtn();
});

/* =========================
   STOP MUSIC WHEN LEAVING THE PAGE
   Covers: closing the tab, navigating away, switching apps
   on mobile, or the tab being backgrounded.
   ========================= */
function stopMusic() {
  if (!bgMusic) return;
  bgMusic.pause();
  bgMusic.currentTime = 0;
}

// Pause while the tab is in the background and resume when the guest comes back
let resumeOnVisible = false;
document.addEventListener("visibilitychange", () => {
  if (!bgMusic) return;
  if (document.hidden) {
    resumeOnVisible = !bgMusic.paused;
    bgMusic.pause();
  } else if (resumeOnVisible) {
    resumeOnVisible = false;
    playMusic();
  }
});

window.addEventListener("pagehide", stopMusic);
window.addEventListener("beforeunload", stopMusic);

/* =========================
   START SCREEN
   ========================= */
startBtn?.addEventListener("click", () => {
  document.body.classList.add("started");
  setTimeout(() => {
    if (startScreen) startScreen.style.display = "none";
  }, 800);
});

/* =========================
   OPEN INVITE (2 seconds total)
   The flap animation itself is handled entirely by CSS
   (body.opening .flap.backTop { animation: flapOpen3s ... })
   so we only need to toggle classes here and keep the
   surrounding timeouts in sync with that 2000ms duration.
   ========================= */
function openInvite() {
  if (!envelope) return;
  if (document.body.classList.contains("opened") || document.body.classList.contains("opening")) return;

  document.body.classList.add("opening");

  // start music
  if (bgMusic && bgMusic.paused) playMusic();

  setTimeout(() => {
    document.body.classList.add("opened");
  }, 1450);

  // The fade itself is the CSS envFade3s animation (delay 1550ms, 450ms long)
  setTimeout(() => {
    envelope.style.pointerEvents = "none";
  }, 1550);

  setTimeout(() => {
    document.body.classList.remove("opening");
    envelope.style.display = "none";
  }, 2000);
}

/* Trigger ONLY from seal press */
sealBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  openInvite();
});

envelope?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault(); // stop Space from scrolling / Enter from also clicking the seal
    openInvite();
  }
});

/* =========================
   LANGUAGE TOGGLE
   ========================= */
langBtn?.addEventListener("click", () => {
  document.body.classList.toggle("lang-ar");
});

/* =========================
   WHISH COPY
   ========================= */
function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  document.body.removeChild(ta);
  if (!ok) throw new Error("Copy command failed");
}

whishCopyBtn?.addEventListener("click", async () => {
  const textToCopy = whishCopyBtn.dataset.copy;

  try {
    // Clipboard API is only available on HTTPS/localhost; fall back otherwise
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(textToCopy);
      } catch {
        fallbackCopy(textToCopy);
      }
    } else {
      fallbackCopy(textToCopy);
    }

    if (whishMsg) {
      whishMsg.textContent = document.body.classList.contains("lang-ar")
        ? "تم نسخ حساب Whish بنجاح ✓"
        : "Whish account copied successfully ✓";

      whishMsg.animate(
        [
          { opacity: 0, transform: "translateY(6px)" },
          { opacity: 1, transform: "translateY(0px)" }
        ],
        { duration: 400, easing: "ease-out" }
      );
    }
  } catch (err) {
    // Show the number so it can still be copied manually
    if (whishMsg) {
      whishMsg.textContent = document.body.classList.contains("lang-ar")
        ? `تعذّر النسخ — رقم الحساب: ${textToCopy}`
        : `Copy failed — account number: ${textToCopy}`;
    }
    console.warn(err);
  }
});

/* =========================
   SCRATCH CIRCLES
   ========================= */
function initScratchCircles() {
  const canvases = document.querySelectorAll(".scratchCanvas");
  const finalEl = document.getElementById("scratchFinal");

  canvases.forEach((canvas) => {
    const item = canvas.closest(".scratchItem");
    if (!item) return;

    const threshold = parseFloat(canvas.dataset.threshold || "0.45");

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let rectSize = 0;
    let dpr = 1;

    // Size the backing store from the rendered (CSS) size
    function sizeCanvas() {
      rectSize = canvas.clientWidth || 140;
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rectSize * dpr);
      canvas.height = Math.floor(rectSize * dpr);
    }

    function drawCover() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);

      ctx.beginPath();
      ctx.arc(rectSize / 2, rectSize / 2, rectSize / 2, 0, Math.PI * 2);
      ctx.clip();

      const g = ctx.createRadialGradient(
        rectSize * 0.35, rectSize * 0.30, 10,
        rectSize / 2, rectSize / 2, rectSize * 0.75
      );
      g.addColorStop(0.0, "rgba(255,244,214,1)");
      g.addColorStop(0.35, "rgba(214,180,107,1)");
      g.addColorStop(0.70, "rgba(242,230,201,1)");
      g.addColorStop(1.0, "rgba(184,146,61,1)");

      ctx.fillStyle = g;
      ctx.fillRect(0, 0, rectSize, rectSize);
      ctx.restore();
    }

    sizeCanvas();
    drawCover();

    let isDown = false;
    let revealed = false;
    const brush = 18;

    function getPos(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
      };
    }

    function scratch(x, y) {
      if (revealed) return;
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(x, y, brush * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Ratio of the CIRCLE that has been scratched. The square corners outside
    // the circle are transparent from the start, so they must not be counted.
    function clearedRatio() {
      const w = canvas.width;
      const h = canvas.height;
      const img = ctx.getImageData(0, 0, w, h).data;
      const cx = w / 2, cy = h / 2, r2 = (w / 2) * (w / 2);
      const step = 3;
      let total = 0;
      let transparent = 0;
      for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
          const dx = x - cx, dy = y - cy;
          if (dx * dx + dy * dy > r2) continue;
          total++;
          if (img[(y * w + x) * 4 + 3] === 0) transparent++;
        }
      }
      return total ? transparent / total : 0;
    }

    function tryReveal() {
      if (revealed) return;

      if (clearedRatio() >= threshold) {
        revealed = true;
        item.classList.add("done");

        canvas.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 350,
          easing: "ease-out",
          fill: "forwards"
        });

        setTimeout(() => ctx.clearRect(0, 0, canvas.width, canvas.height), 360);

        const allDone = document.querySelectorAll(".scratchItem.done").length === canvases.length;
        if (allDone && finalEl) finalEl.classList.remove("hidden");
      }
    }

    canvas.addEventListener("pointerdown", (e) => {
      isDown = true;
      canvas.setPointerCapture?.(e.pointerId);
      const p = getPos(e.clientX, e.clientY);
      scratch(p.x, p.y);
      e.preventDefault();
    });

    canvas.addEventListener("pointermove", (e) => {
      if (!isDown) return;
      const p = getPos(e.clientX, e.clientY);
      scratch(p.x, p.y);
      e.preventDefault();
    });

    canvas.addEventListener("pointerup", () => {
      isDown = false;
      tryReveal();
    });

    canvas.addEventListener("pointercancel", () => {
      isDown = false;
      tryReveal();
    });

    // Only rebuild when the circle's size actually changes. Mobile browsers fire
    // "resize" while scrolling (address bar), which used to wipe scratch progress.
    window.addEventListener("resize", () => {
      if (revealed) return;
      const newSize = canvas.clientWidth || 140;
      const newDpr = window.devicePixelRatio || 1;
      if (Math.abs(newSize - rectSize) < 1 && newDpr === dpr) return;
      sizeCanvas();
      drawCover();
    });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initScratchCircles);
} else {
  initScratchCircles();
}

/* =========================
   GOOGLE SHEET RSVP
   ========================= */
const rsvpForm = document.getElementById("rsvpForm");
const rsvpMsg = document.getElementById("rsvpMsg");

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxjc6smbl6FjY6HXcXa0B6bfNn0_PUW1Dnek8h0Kuv9DmgWt90GPLP89mvC6P71DWwZ/exec";

rsvpForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("rsvpName").value.trim();
  const status = document.getElementById("rsvpStatus").value;
  const guests = document.getElementById("rsvpGuests").value;
  const note = document.getElementById("rsvpNote").value.trim();

  const sendBtn = document.getElementById("rsvpSendBtn");

  if (!name || !status) {
    rsvpMsg.textContent = document.body.classList.contains("lang-ar") ? "يرجى ملء الحقول المطلوبة." : "Please complete required fields.";
    return;
  }

  if (sendBtn) sendBtn.disabled = true; // prevent duplicate submissions

  try {
    // In no-cors mode only "simple" content types are allowed, so send JSON as text/plain
    await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        name,
        status,
        guests,
        note
      })
    });

    rsvpMsg.textContent = document.body.classList.contains("lang-ar") ? "تم إرسال تأكيد الحضور بنجاح ✓" : "RSVP submitted successfully ✓";
    rsvpForm.reset();

  } catch (err) {
    rsvpMsg.textContent = document.body.classList.contains("lang-ar") ? "عذراً، حدث خطأ ما." : "Something went wrong.";
    console.error(err);
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
});
