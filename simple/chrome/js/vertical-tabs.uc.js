// ==UserScript==
// @name         Zen Vertical Tabs & Collapsible Sidebar
// @description  Handles sidebar expand/collapse logic
// ==/UserScript==

(function() {
  'use strict';

  function initZenSidebar() {
    const tabsContainer = document.getElementById('tabbrowser-tabs');
    if (!tabsContainer) return;
  }

  if (document.readyState === 'complete') {
    initZenSidebar();
  } else {
    window.addEventListener('load', initZenSidebar, { once: true });
  }
})();
