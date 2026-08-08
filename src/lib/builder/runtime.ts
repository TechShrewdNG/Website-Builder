/**
 * The runtime shipped with exported and published pages.
 *
 * Held as a plain string so it can be inlined into a document or written out
 * as `assets/builder.js` without a separate build step. Constraints: no
 * dependencies, no globals beyond one IIFE, and it must be idempotent — the
 * editor canvas re-runs it on every re-render.
 *
 * It progressively enhances markup that is already usable without it, so a
 * page never depends on this file to be readable.
 */

export const RUNTIME_JS = `(function () {
  'use strict';

  function initSlider(root) {
    var slides = Array.prototype.slice.call(root.querySelectorAll('.ws-slide'));
    if (!slides.length) return;
    var dots = Array.prototype.slice.call(root.querySelectorAll('.ws-slider-dot'));
    var loop = root.getAttribute('data-loop') !== 'false';
    var index = 0;

    function show(next) {
      if (next < 0) next = loop ? slides.length - 1 : 0;
      if (next >= slides.length) next = loop ? 0 : slides.length - 1;
      index = next;
      slides.forEach(function (slide, i) { slide.hidden = i !== index; });
      dots.forEach(function (dot, i) { dot.setAttribute('aria-selected', String(i === index)); });
    }

    var prev = root.querySelector('.ws-slider-prev');
    var next = root.querySelector('.ws-slider-next');
    if (prev) prev.addEventListener('click', function () { show(index - 1); });
    if (next) next.addEventListener('click', function () { show(index + 1); });
    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () { show(i); });
    });

    if (root.getAttribute('data-autoplay') === 'true') {
      var interval = parseInt(root.getAttribute('data-interval'), 10) || 5000;
      var timer = setInterval(function () { show(index + 1); }, interval);
      // Autoplay that keeps moving while you're reading is hostile.
      root.addEventListener('mouseenter', function () { clearInterval(timer); });
      root.addEventListener('focusin', function () { clearInterval(timer); });
    }

    show(0);
  }

  function initTabs(root) {
    var tabs = Array.prototype.slice.call(root.querySelectorAll('.ws-tab'));
    var panels = Array.prototype.slice.call(root.querySelectorAll('.ws-tab-panel'));
    if (!tabs.length) return;

    function select(i) {
      tabs.forEach(function (tab, j) {
        tab.setAttribute('aria-selected', String(i === j));
        tab.tabIndex = i === j ? 0 : -1;
      });
      panels.forEach(function (panel, j) { panel.hidden = i !== j; });
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(i); });
      tab.addEventListener('keydown', function (event) {
        var delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (!delta) return;
        event.preventDefault();
        var next = (i + delta + tabs.length) % tabs.length;
        select(next);
        tabs[next].focus();
      });
    });

    select(0);
  }

  function initAccordion(root) {
    var allowMultiple = root.getAttribute('data-allow-multiple') === 'true';
    var triggers = Array.prototype.slice.call(root.querySelectorAll('.ws-accordion-trigger'));

    triggers.forEach(function (trigger) {
      trigger.addEventListener('click', function () {
        var panel = document.getElementById(trigger.getAttribute('aria-controls'));
        var isOpen = trigger.getAttribute('aria-expanded') === 'true';

        if (!allowMultiple && !isOpen) {
          triggers.forEach(function (other) {
            if (other === trigger) return;
            other.setAttribute('aria-expanded', 'false');
            var otherPanel = document.getElementById(other.getAttribute('aria-controls'));
            if (otherPanel) otherPanel.hidden = true;
            var otherMarker = other.querySelector('.ws-accordion-marker');
            if (otherMarker) otherMarker.textContent = '+';
          });
        }

        trigger.setAttribute('aria-expanded', String(!isOpen));
        if (panel) panel.hidden = isOpen;
        var marker = trigger.querySelector('.ws-accordion-marker');
        if (marker) marker.textContent = isOpen ? '+' : '\\u2212';
      });
    });
  }

  function initCounter(root) {
    var target = root.querySelector('[data-counter-value]');
    if (!target) return;
    var start = parseFloat(root.getAttribute('data-start')) || 0;
    var end = parseFloat(root.getAttribute('data-end')) || 0;
    var duration = parseInt(root.getAttribute('data-duration'), 10) || 2000;

    function run() {
      // Respect the OS-level preference rather than animating regardless.
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        target.textContent = String(Math.round(end));
        return;
      }
      var began = null;
      function step(timestamp) {
        if (began === null) began = timestamp;
        var progress = Math.min((timestamp - began) / duration, 1);
        // easeOutQuad, so the number settles instead of stopping dead.
        var eased = 1 - (1 - progress) * (1 - progress);
        target.textContent = String(Math.round(start + (end - start) * eased));
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    if (typeof IntersectionObserver === 'undefined') { run(); return; }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        run();
      });
    }, { threshold: 0.4 });
    observer.observe(root);
  }

  var INITS = { slider: initSlider, tabs: initTabs, accordion: initAccordion, counter: initCounter };

  function boot() {
    var nodes = document.querySelectorAll('[data-ws-widget]');
    Array.prototype.forEach.call(nodes, function (node) {
      // Re-running boot() must not double-bind listeners.
      if (node.getAttribute('data-ws-ready') === 'true') return;
      var init = INITS[node.getAttribute('data-ws-widget')];
      if (!init) return;
      node.setAttribute('data-ws-ready', 'true');
      init(node);
    });
  }

  window.wsBoot = boot;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
`;
