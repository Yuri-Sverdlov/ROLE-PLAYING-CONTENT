// ==UserScript==
// @name         Dream Companion — Переводчик на русский v2.1
// @namespace    https://mydreamcompanion.com/
// @version      2.1
// @description  Переводит чат и описания карточек на русский. Модули включаются/выключаются независимо.
// @author       Yuri + Claude
// @match        https://www.mydreamcompanion.com/*
// @match        https://mydreamcompanion.com/*
// @match        *://www.mydreamcompanion.com/*
// @match        *://mydreamcompanion.com/*
// @include      https://www.mydreamcompanion.com/*
// @include      https://mydreamcompanion.com/*
// @grant        none
// @connect      translate.googleapis.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ╔══════════════════════════════════════════════════════════╗
  // ║  НАСТРОЙКИ — переключай true/false для каждого модуля   ║
  // ╠══════════════════════════════════════════════════════════╣
  // ║  Если перевод каталога мешает — поставь false            ║
  // ╚══════════════════════════════════════════════════════════╝
  var ENABLE_CHAT = true;      // Перевод сообщений в чате
  var ENABLE_CATALOG = true;   // Перевод описаний карточек в каталоге

  var LANG_FROM = 'en';
  var LANG_TO = 'ru';
  var POLL_INTERVAL = 2000;

  // --- Определяем, на какой странице мы ---
  var isChat = /\/companion\/\d+\/chat/.test(location.pathname);

  console.log('[DC-Translator v2.1] Starting on: ' + location.href);
  console.log('[DC-Translator v2.1] isChat: ' + isChat);

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

  // ────────────────────────────────────────────────────────
  //  МОДУЛЬ 1: ЧАТ — перевод сообщений с сохранением структуры
  // ────────────────────────────────────────────────────────
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

  // ────────────────────────────────────────────────────────
  //  МОДУЛЬ 2: КАТАЛОГ — перевод описаний карточек
  // ────────────────────────────────────────────────────────
  var CARD_DESC_SELECTOR = 'p.line-clamp-2';

  async function catalogTranslateCard(pEl) {
    if (pEl.dataset.dcTranslated) return;
    var text = pEl.innerText.trim();
    // Пропускаем, если текст уже на русском или слишком короткий
    if (text.length < 10 || /[а-яё]/i.test(text)) {
      pEl.dataset.dcTranslated = 'skip';
      return;
    }
    pEl.dataset.dcTranslated = 'pending';
    var translated = await tr(text);
    if (!translated) { pEl.dataset.dcTranslated = ''; return; }

    // Добавляем перевод строкой ниже описания
    var div = document.createElement('p');
    div.className = 'dc-catalog-translation';
    div.style.cssText =
      'color:#a8c8ff;font-size:10px;line-height:1.4;' +
      'margin-top:2px;font-weight:normal;';
    div.innerText = translated;

    // Вставляем после оригинального описания
    if (pEl.nextSibling) {
      pEl.parentNode.insertBefore(div, pEl.nextSibling);
    } else {
      pEl.parentNode.appendChild(div);
    }
    pEl.dataset.dcTranslated = 'done';
  }

  function catalogPoll() {
    var descs = document.querySelectorAll(
      CARD_DESC_SELECTOR + ':not([data-dc-translated])'
    );
    descs.forEach(catalogTranslateCard);
  }

  // ────────────────────────────────────────────────────────
  //  ЗАПУСК
  // ────────────────────────────────────────────────────────
  setTimeout(function () {
    var modules = [];

    if (ENABLE_CHAT && isChat) {
      chatPoll();
      setInterval(chatPoll, POLL_INTERVAL);
      modules.push('chat');
    }

    if (ENABLE_CATALOG && !isChat) {
      catalogPoll();
      setInterval(catalogPoll, POLL_INTERVAL);
      // Также подхватываем подгрузку при скролле
      window.addEventListener('scroll', function () {
        setTimeout(catalogPoll, 500);
      }, { passive: true });
      modules.push('catalog');
    }

    console.log('[DC-Translator v2.1] Active modules: ' + modules.join(', '));
  }, 2000);
})();