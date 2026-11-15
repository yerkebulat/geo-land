/* Floating dock (all pages): scroll-to-top / scroll-to-bottom arrows + WhatsApp chat button.
   Load after js/i18n.js. */
(function () {
  const WA_URL = "https://wa.me/77752543364"; // Nursultan Utebayev: 8 775 254 33 64 → +7 775 254 33 64
  const EDGE = 80; // px from top/bottom that counts as "at the edge"

  const ICON_UP =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
  const ICON_DOWN =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>';
  const ICON_WA =
    '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path fill="currentColor" d="M16.04 3C8.86 3 3.03 8.82 3.03 16c0 2.3.6 4.53 1.74 6.5L3 29l6.68-1.75A12.95 12.95 0 0 0 16.04 29C23.2 29 29.03 23.18 29.03 16S23.2 3 16.04 3Zm0 23.62c-2.02 0-4-.54-5.72-1.57l-.41-.24-3.96 1.04 1.06-3.86-.27-.4A10.6 10.6 0 0 1 5.4 16c0-5.86 4.77-10.63 10.64-10.63S26.67 10.14 26.67 16s-4.77 10.62-10.63 10.62Zm5.83-7.96c-.32-.16-1.89-.93-2.18-1.04-.29-.11-.5-.16-.72.16-.21.32-.82 1.04-1.01 1.25-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.9-1.78-2.22-.19-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.72-1.73-.98-2.37-.26-.62-.52-.54-.72-.55h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.66s1.15 3.09 1.31 3.3c.16.21 2.26 3.45 5.47 4.84.76.33 1.36.53 1.83.68.77.24 1.47.21 2.02.13.62-.09 1.89-.77 2.16-1.52.27-.75.27-1.39.19-1.52-.08-.13-.29-.21-.61-.37Z"/></svg>';

  function t(key, fallback) {
    return window.Lang ? Lang.t(key) : fallback;
  }

  function build() {
    if (document.querySelector(".float-dock")) return;
    const dock = document.createElement("div");
    dock.className = "float-dock";
    dock.innerHTML = `
      <button type="button" class="scroll-btn scroll-btn-top" hidden>${ICON_UP}</button>
      <button type="button" class="scroll-btn scroll-btn-bottom" hidden>${ICON_DOWN}</button>
      <a class="wa-float" href="${WA_URL}" target="_blank" rel="noopener noreferrer">${ICON_WA}</a>`;
    document.body.appendChild(dock);

    const up = dock.querySelector(".scroll-btn-top");
    const down = dock.querySelector(".scroll-btn-bottom");
    const wa = dock.querySelector(".wa-float");

    function labels() {
      const top = t("scroll_top", "Back to top");
      const bottom = t("scroll_bottom", "Go to bottom");
      const chat = t("wa_float", "Chat on WhatsApp");
      up.setAttribute("aria-label", top);
      up.title = top;
      down.setAttribute("aria-label", bottom);
      down.title = bottom;
      wa.setAttribute("aria-label", chat);
      wa.title = chat;
    }

    const smooth = () =>
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

    up.addEventListener("click", () => window.scrollTo({ top: 0, behavior: smooth() }));
    down.addEventListener("click", () =>
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: smooth() })
    );

    let raf = 0;
    function update() {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const y = window.scrollY || doc.scrollTop || 0;
      const scrollable = max > EDGE * 1.5;
      up.hidden = !scrollable || y <= EDGE;
      down.hidden = !scrollable || y >= max - EDGE;
    }
    function schedule() {
      if (!raf) raf = requestAnimationFrame(update);
    }

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("load", schedule);
    window.addEventListener("langchange", () => {
      labels();
      schedule();
    });
    if (window.ResizeObserver) new ResizeObserver(schedule).observe(document.body);

    labels();
    update();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
