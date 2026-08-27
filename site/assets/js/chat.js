(function () {
  "use strict";

  var WORKER_URL = "https://waf-docs-chat-proxy.cloudflaretestt.workers.dev/chat";

  var SUGGESTIONS = [
    "ระบบนี้เป็น CDN จริงไหม?",
    "ML แม่นแค่ไหน พลาดจับอะไรบ้าง?",
    "ตอนนี้มีช่องโหว่ความปลอดภัยอะไรบ้าง?",
    "ผลทดสอบ WAF จริงเป็นยังไงบ้าง?",
  ];

  var history = []; // [{role:'user'|'model', text}]
  var pending = false;

  function el(tag, cls, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  // ---- build DOM ----
  var launcher = el("button", "chat-launcher", { "aria-label": "เปิดแชทถามเกี่ยวกับโปรเจกต์นี้", type: "button" });
  launcher.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg><span class="badge"></span>';

  var panel = el("section", "chat-panel", { role: "dialog", "aria-label": "แชทถามเกี่ยวกับโปรเจกต์ WAF + CDN" });

  var head = el("div", "chat-head");
  var headText = el("div");
  headText.innerHTML = '<span class="t">ถามเกี่ยวกับโปรเจกต์นี้</span><span class="s">ตอบด้วย Gemini · อ้างอิงจากเนื้อหาบนเว็บนี้</span>';
  var closeBtn = el("button", "chat-close", { type: "button", "aria-label": "ปิดแชท" });
  closeBtn.textContent = "×";
  head.appendChild(headText);
  head.appendChild(closeBtn);

  var log = el("div", "chat-log", { "aria-live": "polite" });

  var empty = el("div", "chat-empty");
  empty.innerHTML = "ถามอะไรก็ได้เกี่ยวกับสถาปัตยกรรม สถานะความสามารถ หรือช่องโหว่ที่พบในระบบนี้ — คำตอบอ้างอิงจากเนื้อหาบนเว็บนี้เท่านั้น";
  var suggWrap = el("div", "sugg");
  SUGGESTIONS.forEach(function (s) {
    var b = el("button", null, { type: "button" });
    b.textContent = s;
    b.addEventListener("click", function () { send(s); });
    suggWrap.appendChild(b);
  });
  empty.appendChild(suggWrap);
  log.appendChild(empty);

  var form = el("form", "chat-form");
  var textarea = el("textarea", null, { rows: "1", placeholder: "พิมพ์คำถาม…", maxlength: "600" });
  var sendBtn = el("button", null, { type: "submit", "aria-label": "ส่งคำถาม" });
  sendBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
  form.appendChild(textarea);
  form.appendChild(sendBtn);

  var disclaimer = el("div", "chat-disclaimer");
  disclaimer.textContent = "AI อาจตอบผิดพลาดได้ — ตรวจสอบกับเนื้อหาเอกสารจริงเสมอ";

  panel.appendChild(head);
  panel.appendChild(log);
  panel.appendChild(form);
  panel.appendChild(disclaimer);

  document.body.appendChild(launcher);
  document.body.appendChild(panel);

  // ---- behavior ----
  function openPanel() {
    panel.classList.add("open");
    launcher.setAttribute("aria-expanded", "true");
    setTimeout(function () { textarea.focus(); }, 50);
  }
  function closePanel() {
    panel.classList.remove("open");
    launcher.setAttribute("aria-expanded", "false");
  }
  launcher.addEventListener("click", function () {
    panel.classList.contains("open") ? closePanel() : openPanel();
  });
  closeBtn.addEventListener("click", closePanel);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && panel.classList.contains("open")) closePanel();
  });

  textarea.addEventListener("input", function () {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 90) + "px";
  });
  textarea.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  function addMsg(role, text) {
    if (empty.parentNode) log.removeChild(empty);
    var msg = el("div", "chat-msg " + role);
    msg.textContent = text; // never innerHTML — model output is untrusted
    log.appendChild(msg);
    log.scrollTop = log.scrollHeight;
    return msg;
  }

  function addTyping() {
    var t = el("div", "chat-typing", { "aria-label": "กำลังตอบ" });
    t.innerHTML = "<span></span><span></span><span></span>";
    log.appendChild(t);
    log.scrollTop = log.scrollHeight;
    return t;
  }

  function send(text) {
    text = (text || textarea.value).trim();
    if (!text || pending) return;
    pending = true;
    sendBtn.disabled = true;
    textarea.value = "";
    textarea.style.height = "auto";

    addMsg("user", text);
    var typing = addTyping();

    var payloadHistory = history.slice(-16);

    fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history: payloadHistory }),
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, status: res.status, data: data }; });
      })
      .then(function (r) {
        typing.remove();
        if (r.ok && r.data && r.data.reply) {
          addMsg("model", r.data.reply);
          history.push({ role: "user", text: text });
          history.push({ role: "model", text: r.data.reply });
        } else if (r.status === 429) {
          addMsg("error", (r.data && r.data.error) || "ถามถี่เกินไป รอสักครู่แล้วลองใหม่");
        } else {
          addMsg("error", (r.data && r.data.error) || "ขอโทษด้วย ตอบไม่ได้ตอนนี้ ลองใหม่อีกครั้ง");
        }
      })
      .catch(function () {
        typing.remove();
        addMsg("error", "เชื่อมต่อไม่ได้ — เช็คอินเทอร์เน็ตแล้วลองใหม่");
      })
      .finally(function () {
        pending = false;
        sendBtn.disabled = false;
      });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    send();
  });
})();
