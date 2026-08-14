// ==UserScript==
// @name         Vertical Tabs & Collapsible Sidebar
// @description  Handles sidebar expand/collapse logic
// ==/UserScript==

(function() {
  'use strict';

  function initSidebar() {
    const tabsContainer = document.getElementById('tabbrowser-tabs');
    if (!tabsContainer) return;
  }

  if (document.readyState === 'complete') {
    initSidebar();
  } 
  else {
    window.addEventListener('load', initSidebar, { once: true });
  }
})();


