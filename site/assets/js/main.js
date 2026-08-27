(function(){
  "use strict";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- mobile nav toggle ---- */
  var toggle = document.querySelector(".nav-toggle");
  if (toggle) {
    toggle.addEventListener("click", function(){
      document.body.classList.toggle("nav-open");
    });
    document.addEventListener("click", function(e){
      if (document.body.classList.contains("nav-open") &&
          !e.target.closest(".sidebar") && !e.target.closest(".nav-toggle")) {
        document.body.classList.remove("nav-open");
      }
    });
    document.addEventListener("keydown", function(e){
      if (e.key === "Escape") document.body.classList.remove("nav-open");
    });
  }

  /* ---- scroll reveal ---- */
  var revealEls = document.querySelectorAll(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach(function(el){ el.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: "0px 0px 40px 0px" });
    revealEls.forEach(function(el){ io.observe(el); });
    // safety net: never leave content permanently invisible (slow layout,
    // pre-render/screenshot tools that don't dispatch scroll/resize in time)
    setTimeout(function(){
      revealEls.forEach(function(el){ el.classList.add("in"); });
    }, 1800);
  }

  /* ---- animated counters ---- */
  var counters = document.querySelectorAll("[data-count]");
  function animateCounter(el){
    var target = parseFloat(el.getAttribute("data-count"));
    var decimals = el.getAttribute("data-decimals") ? parseInt(el.getAttribute("data-decimals"), 10) : 0;
    var suffix = el.getAttribute("data-suffix") || "";
    if (reduceMotion) { el.textContent = target.toFixed(decimals) + suffix; return; }
    var start = null, dur = 1200;
    function step(ts){
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if (counters.length) {
    if ("IntersectionObserver" in window) {
      var counted = [];
      var cio = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if (entry.isIntersecting) { animateCounter(entry.target); counted.push(entry.target); cio.unobserve(entry.target); }
        });
      }, { threshold: 0.2 });
      counters.forEach(function(el){ cio.observe(el); });
      setTimeout(function(){
        counters.forEach(function(el){ if (counted.indexOf(el) === -1) animateCounter(el); });
      }, 1800);
    } else {
      counters.forEach(animateCounter);
    }
  }

  /* ---- status-pill filter legend ---- */
  var legend = document.querySelector(".legend[data-filter-target]");
  if (legend) {
    var targetSel = legend.getAttribute("data-filter-target");
    var items = document.querySelectorAll(targetSel);
    var buttons = legend.querySelectorAll("button.status-pill");
    var active = null;
    buttons.forEach(function(btn){
      btn.addEventListener("click", function(){
        var status = btn.getAttribute("data-status");
        if (active === status) {
          active = null;
          legend.removeAttribute("data-active");
          document.body.classList.remove("filtering");
          buttons.forEach(function(b){ b.classList.remove("is-active"); });
          items.forEach(function(it){ it.removeAttribute("data-hide"); });
          return;
        }
        active = status;
        legend.setAttribute("data-active", "true");
        document.body.classList.add("filtering");
        buttons.forEach(function(b){ b.classList.toggle("is-active", b === btn); });
        items.forEach(function(it){
          it.setAttribute("data-hide", it.getAttribute("data-status") === status ? "false" : "true");
        });
      });
    });
  }

  /* ---- hero pipeline animation (signature element) ---- */
  var pipeline = document.querySelector("[data-pipeline]");
  if (pipeline) {
    var packet = pipeline.querySelector(".pipeline-packet");
    var fill = pipeline.querySelector(".pipeline-track .fill");
    var track = pipeline.querySelector(".pipeline-track");
    var nodes = pipeline.querySelectorAll(".pipeline-node");
    var logEl = pipeline.querySelector(".pipeline-log");
    var scenarios = [
      {
        path: "GET /login?id=1' OR '1'='1",
        blockAt: 1, // index of node where it gets blocked (0-based)
        rule: "OWASP CRS 942100 — SQL Injection",
        verdict: "403 BLOCKED",
        risk: true
      },
      {
        path: "GET /products?category=laptops",
        blockAt: -1,
        rule: "ModSecurity CRS — clean",
        verdict: "200 PASSED → origin",
        risk: false
      },
      {
        path: "POST /api/users/2/records (BOLA probe)",
        blockAt: 2,
        rule: "bola_guard.py — object ownership mismatch",
        verdict: "403 BLOCKED",
        risk: true
      }
    ];
    var si = 0;

    function run(){
      var s = scenarios[si % scenarios.length];
      si++;
      nodes.forEach(function(n){ n.classList.remove("active","blocked"); });
      if (fill) fill.style.width = "0%";
      if (packet) { packet.classList.remove("blocked","passed"); packet.style.left = "0%"; }
      logEl.innerHTML = '<span class="path">' + s.path + "</span>";

      var stops = [0, 33, 66, 100];
      var stopAt = s.blockAt === -1 ? 3 : s.blockAt;
      var dur = reduceMotion ? 0 : 900;
      var i = 0;

      function nextHop(){
        if (i > stopAt) {
          logEl.innerHTML =
            '<span class="path">' + s.path + '</span><br>' +
            '<span class="' + (s.risk ? "verdict-risk" : "verdict-ok") + '">' + s.verdict + "</span>" +
            ' <span class="path">— ' + s.rule + "</span>";
          window._pipelineTimer = setTimeout(run, 2600);
          return;
        }
        nodes[Math.min(i,3)].classList.add("active");
        if (fill) fill.style.width = stops[Math.min(i,3)] + "%";
        if (packet) {
          packet.style.transition = dur ? "left " + dur + "ms cubic-bezier(.4,.6,.2,1)" : "none";
          packet.style.left = stops[Math.min(i,3)] + "%";
        }
        if (i === stopAt && s.risk) {
          setTimeout(function(){
            nodes[i].classList.remove("active");
            nodes[i].classList.add("blocked");
            if (packet) packet.classList.add("blocked");
          }, dur * 0.9);
        } else if (i === 3) {
          if (packet) packet.classList.add("passed");
        }
        i++;
        window._pipelineTimer = setTimeout(nextHop, dur + 500);
      }
      nextHop();
    }
    run();
  }

  /* ---- geo-routing simulator (CDN-completeness demo) ---- */
  var geoDemo = document.querySelector("[data-geo-demo]");
  if (geoDemo) {
    var GEO_X = { sg: 10, jp: 90, th: 50 };
    var GEO_NAME = { sg: "สิงคโปร์", jp: "ญี่ปุ่น", th: "ไทย" };
    var client = "sg";
    var mode = "now";

    var clientEl = geoDemo.querySelector(".geo-client");
    var lineEl = geoDemo.querySelector(".geo-line");
    var pins = geoDemo.querySelectorAll(".geo-pin");
    var labels = geoDemo.querySelectorAll(".geo-pin-label");
    var caption = geoDemo.querySelector("[data-caption]");
    var clientBtns = geoDemo.querySelectorAll("[data-client]");
    var modeBtns = geoDemo.querySelectorAll("[data-mode]");

    function renderGeo() {
      var clientX = GEO_X[client];
      var targetKey = mode === "now" ? "th" : client;
      var targetX = GEO_X[targetKey];

      clientEl.style.left = clientX + "%";
      clientEl.textContent = GEO_NAME[client][0];

      var left = Math.min(clientX, targetX);
      var width = Math.abs(targetX - clientX);
      lineEl.style.left = left + "%";
      lineEl.style.width = width + "%";
      lineEl.classList.toggle("active", true);

      pins.forEach(function (p) {
        p.classList.toggle("hit", p.getAttribute("data-pin") === targetKey);
      });
      labels.forEach(function (l, i) {
        l.classList.toggle("hit", pins[i].getAttribute("data-pin") === targetKey);
      });

      clientBtns.forEach(function (b) {
        b.classList.toggle("is-active", b.getAttribute("data-client") === client);
      });
      modeBtns.forEach(function (b) {
        b.classList.toggle("is-active", b.getAttribute("data-mode") === mode);
      });

      if (caption) {
        if (mode === "now") {
          caption.innerHTML =
            'ผู้ใช้จาก <b>' + GEO_NAME[client] + "</b> ถูกส่งไป edge เดียวที่ deploy จริงตอนนี้ — <b class=\"bad\">Edge: ไทย เสมอ</b> ไม่ว่าอยู่ภูมิภาคไหน (DNS เป็น A record ตายตัว ไม่ผ่าน GeoDNS)";
        } else {
          var same = client === "th";
          caption.innerHTML = same
            ? 'ผู้ใช้จาก <b>' + GEO_NAME[client] + "</b> อยู่ใกล้ edge ไทยอยู่แล้ว — เส้นทางเหมือนเดิม"
            : 'ผู้ใช้จาก <b>' + GEO_NAME[client] + "</b> จะถูก GeoDNS ส่งไป <b>Edge: " + GEO_NAME[client] + "</b> แทน — เงื่อนไข: ต้อง deploy edge ภูมิภาคนั้นจริงก่อน (โค้ดพร้อมแล้ว)";
        }
      }
    }

    clientBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        client = b.getAttribute("data-client");
        renderGeo();
      });
    });
    modeBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        mode = b.getAttribute("data-mode");
        renderGeo();
      });
    });
    renderGeo();
  }

  /* ---- test console (replay real recorded results) ---- */
  var consoles = document.querySelectorAll("[data-test-console]");
  consoles.forEach(function (box) {
    var out = box.querySelector("[data-console-out]");
    var btns = box.querySelectorAll(".console-grid button");
    btns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        btns.forEach(function (b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
        var cmd = btn.getAttribute("data-cmd");
        var code = btn.getAttribute("data-code");
        var status = btn.getAttribute("data-status");
        var verdict = btn.getAttribute("data-verdict");
        var delay = reduceMotion ? 0 : 380;
        out.innerHTML = '<span class="cmd">' + cmd + "</span>" +
          '<span class="placeholder">กำลังส่ง request…</span>';
        setTimeout(function () {
          out.innerHTML =
            '<span class="cmd">' + cmd + "</span>" +
            '<div class="resp"><span class="code ' + status + '">' + code + "</span>" +
            '<span class="note">' + verdict + "</span></div>" +
            '<span class="note" style="opacity:.7">ผลจริงที่บันทึกไว้ 27 ส.ค. 2026 — ไม่ใช่การยิงสดจากหน้านี้</span>';
        }, delay);
      });
    });
  });

  /* set current year */
  document.querySelectorAll("[data-year]").forEach(function(el){
    el.textContent = new Date().getFullYear();
  });
})();
