// ==UserScript==
// @name         Dream Companion — Переводчик чата на русский
// @namespace    https://mydreamcompanion.com/
// @version      1.0
// @description  Автоматически переводит сообщения чата на русский язык, сохраняя структуру (речь, нарратив, заголовки)
// @author       Yuri + Claude
// @match        https://www.mydreamcompanion.com/*/companion/*/chat/*
// @match        https://www.mydreamcompanion.com/*/companion/*/chat
// @grant        none
// @connect      translate.googleapis.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  var LANG_FROM = 'en';
  var LANG_TO = 'ru';
  var POLL_INTERVAL = 2000;

  // --- Google Translate API ---
  async function tr(text) {
    if (!text || text.trim().length < 3) return null;
    try {
      var url =
        'https://translate.googleapis.com/translate_a/single?client=gtx' +
        '&sl=' + LANG_FROM + '&tl=' + LANG_TO +
        '&dt=t&q=' + encodeURIComponent(text);
      var res = await fetch(url);
      var data = await res.json();
      return data[0].map(function (s) { return s[0]; }).join('');
    } catch (e) {
      console.warn('[DC-Translator] error:', e);
      return null;
    }
  }

  // --- Перевод одного блока сообщения ---
  async function chatTranslateBlock(textDiv) {
    if (textDiv.dataset.dcTranslated) return;
    textDiv.dataset.dcTranslated = 'pending';

    var innerDiv = textDiv.querySelector('div:not(.dc-translation-ru)');
    var source = innerDiv || textDiv;
    var elements = Array.from(source.children).filter(function (c) {
      return !c.classList.contains('dc-translation-ru');
    });

    // Нет вложенных — переводим целиком
    if (elements.length === 0) {
      var fullText = textDiv.innerText.trim();
      if (fullText.length < 5) return;
      var fullTranslated = await tr(fullText);
      if (!fullTranslated) { textDiv.dataset.dcTranslated = ''; return; }
      var simple = document.createElement('div');
      simple.className = 'dc-translation-ru';
      simple.style.cssText =
        'margin-top:12px;padding-top:10px;' +
        'border-top:1px solid rgba(100,150,255,0.25);' +
        'color:#a8c8ff;font-size:0.85rem;line-height:1.6;white-space:pre-wrap;';
      simple.innerText = fullTranslated;
      textDiv.appendChild(simple);
      textDiv.dataset.dcTranslated = 'done';
      return;
    }

    // Поблочный перевод с сохранением стиля
    var container = document.createElement('div');
    container.className = 'dc-translation-ru';
    container.style.cssText =
      'margin-top:12px;padding-top:10px;' +
      'border-top:1px solid rgba(100,150,255,0.25);' +
      'color:#a8c8ff;font-size:0.85rem;line-height:1.6;';

    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      var text = el.innerText.trim();
      if (!text) {
        var spacer = document.createElement('div');
        spacer.style.height = '0.5em';
        container.appendChild(spacer);
        continue;
      }
      var translated = await tr(text);
      if (!translated) continue;
      var p = document.createElement('div');
      var tag = el.tagName;
      if (tag === 'Q') {
        p.style.cssText = 'font-weight:bold;color:#c8d8ff;margin:4px 0;';
      } else if (tag === 'EM') {
        p.style.cssText = 'font-style:italic;opacity:0.85;margin:4px 0;';
      } else {
        p.style.cssText = 'margin:4px 0;';
      }
      p.innerText = translated;
      container.appendChild(p);
    }

    textDiv.appendChild(container);
    textDiv.dataset.dcTranslated = 'done';
  }

  function chatPoll() {
    var blocks = document.querySelectorAll(
      'div[class*="text-[#d1d1d1]"]:not([data-dc-translated])'
    );
    blocks.forEach(chatTranslateBlock);
  }

  // --- Запуск ---
  setTimeout(function () {
    chatPoll();
    setInterval(chatPoll, POLL_INTERVAL);
    console.log('[DC-Translator v1.0] Chat translator active');
  }, 2000);
})();
