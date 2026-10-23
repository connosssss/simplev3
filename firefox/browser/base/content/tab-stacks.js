/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var TabStacks = {
  STACK_KEY: "tab-stack",
  COLLAPSED_KEY: "tab-stack.collapsed",

  get SessionStore() {
    if (this._SessionStore) {
      return this._SessionStore;
    }
    if (typeof SessionStore !== "undefined") {
      this._SessionStore = SessionStore;
      return this._SessionStore;
    }
    if (window.SessionStore) {
      this._SessionStore = window.SessionStore;
      return this._SessionStore;
    }
    try {
      this._SessionStore = ChromeUtils.importESModule(
        "moz-src:///browser/components/sessionstore/SessionStore.sys.mjs"
      ).SessionStore;
      return this._SessionStore;
    } catch (e) {
      return window.SessionStore;
    }
  },

  init() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;
    this._lastSelectedTabs = new Map();

    this._onTabOpen = event => {
      let sourceTab = event.target.openerTab;
      if (sourceTab) {
        this.addToSourceStack(event.target, sourceTab);
      }
      this.refresh();
    };
    this._onTabClose = () => this.refresh();
    this._onTabSelect = event => {
      let stackId = this.stackId(event.target);
      if (stackId) {
        this._lastSelectedTabs.set(stackId, event.target);
      }
      if (this._isDraggingTab || this._mouseDownOnTab) {
        return;
      }
      this.expandStack(event.target);
      this.refresh();
    };
    this._onTabAttrModified = () => {
      if (this._isDraggingTab || this._mouseDownOnTab) {
        return;
      }
      this.renderStackBars();
    };
    // Main tab-bar drags keep a stack together; the stack bar can pull out one tab.
    this._onTabMove = () => this.refresh();
    this._onPopupShowing = event => {
      if (event.target == this.menu) {
        this.updateMenu();
      }
    };

    this._onTabMouseDown = event => {

      if (event.button !== 0) {
        return;
      }

      let tab = event.target.closest("tab, .tabbrowser-tab");
      if (tab) {
        this._mouseDownOnTab = true;
      }
    };

    this._onTabMouseUp = () => {
      if (this._mouseDownOnTab) {
        this._mouseDownOnTab = false;
        this.expandStack(gBrowser.selectedTab);
        this.refresh();
      }
    };

    this._onDragStart = event => {
      this._mouseDownOnTab = false;
      let target = event.target;
      let tab = target?.closest?.("tab, .tabbrowser-tab");
      let stackTab = target?.closest?.(".tab-stack-tab");

      if (this._draggedStackTab || tab || stackTab) {
        this._isDraggingTab = true;
      }

      if (tab && !stackTab) {
        this._draggedExternalTab = tab;
      }
    };

    this._onDragEnd = () => {
      this._isDraggingTab = false;
      this._mouseDownOnTab = false;
      this._draggedStackTab = null;
      this._draggedExternalTab = null;
      this._draggedButton = null;
      this._clearTabStripDropIndicator();

      let row = document.querySelector(".tab-stack-bar-row");
      if (row) {
        for (let child of row.children) {
          child.removeAttribute("stack-drop-before");
          child.removeAttribute("stack-drop-after");
          child.removeAttribute("stack-dragging");
        }
      }

      this.refresh();
    };

    this._onTabStripDragOver = event => {
      if (!this.isTabDrag(event)) {
        return;
      }

      let draggedTab = this.getDraggedTab(event);
      let targetTab = event.target.closest("tab, .tabbrowser-tab");
      if (draggedTab) {
        if (
          !this._draggedStackTab &&
          !this.stackId(draggedTab) &&
          !(targetTab && this.stackId(targetTab))
        ) {
          return;
        }
      } 
      else if (!this._draggedStackTab) {
        return;
      }


      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      this._updateTabStripDropIndicator(event);
    };

    this._onTabStripDragLeave = event => {
      if (event.relatedTarget && !gBrowser.tabContainer.contains(event.relatedTarget)) {
        this._clearTabStripDropIndicator();
      }
    };

    this._onTabStripDrop = event => {
      if (!this.isTabDrag(event)) {
        return;
      }

      let draggedTab = this.getDraggedTab(event);
      let targetTab = event.target.closest("tab, .tabbrowser-tab");
      if (!targetTab) {
        targetTab = gBrowser.visibleTabs.at(-1);
      }
      if (
        !draggedTab ||
        (!this._draggedStackTab &&
          !this.stackId(draggedTab) &&
          !(targetTab && this.stackId(targetTab)))
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      this._clearTabStripDropIndicator();

      let isVertical = gBrowser.tabContainer.getAttribute("orient") == "vertical";
      let dropBefore = false;

      if (targetTab && targetTab !== draggedTab) {
        let tabRect = targetTab.getBoundingClientRect();
        dropBefore = isVertical
          ? event.clientY < tabRect.top + tabRect.height / 2
          : event.clientX < tabRect.left + tabRect.width / 2;
      }

      if (!this._draggedStackTab && this.stackId(draggedTab)) {
        this.moveStack(draggedTab, targetTab, dropBefore);
      } else {
        this.setStack(draggedTab, "");
        this.SessionStore.deleteCustomTabValue(draggedTab, this.COLLAPSED_KEY);

        if (targetTab && targetTab !== draggedTab) {
          let targetTabs = this.stackTabs(targetTab);
          targetTab = targetTabs.length
            ? targetTabs[dropBefore ? 0 : targetTabs.length - 1]
            : targetTab;
          if (dropBefore) {
            gBrowser.moveTabBefore(draggedTab, targetTab);
          }
          else {
            gBrowser.moveTabAfter(draggedTab, targetTab);
          }
        }
      }

      this._draggedStackTab = null;
      this._draggedExternalTab = null;
      this._draggedButton = null;
      this._isDraggingTab = false;
      this._mouseDownOnTab = false;
      this.refresh();
    };
    gBrowser.tabContainer.addEventListener("TabOpen", this._onTabOpen);
    gBrowser.tabContainer.addEventListener("TabClose", this._onTabClose);
    gBrowser.tabContainer.addEventListener("TabSelect", this._onTabSelect);
    gBrowser.tabContainer.addEventListener("TabMove", this._onTabMove);
    gBrowser.tabContainer.addEventListener(
      "TabAttrModified",
      this._onTabAttrModified
    );
    gBrowser.tabContainer.addEventListener(
      "mousedown",
      this._onTabMouseDown,
      true
    );
    gBrowser.tabContainer.addEventListener(
      "dragover",
      this._onTabStripDragOver,
      true
    );
    gBrowser.tabContainer.addEventListener(
      "dragleave",
      this._onTabStripDragLeave,
      true
    );
    gBrowser.tabContainer.addEventListener(
      "drop",
      this._onTabStripDrop,
      true
    );
    window.addEventListener("mouseup", this._onTabMouseUp, true);
    window.addEventListener("dragstart", this._onDragStart, true);
    window.addEventListener("dragend", this._onDragEnd, true);
    this.menu = document.getElementById("tabContextMenu");
    this.menu.addEventListener("popupshowing", this._onPopupShowing);
    this.refresh();
  },

  uninit() {
    if (!this._initialized) {
      return;
    }
    gBrowser.tabContainer.removeEventListener("TabOpen", this._onTabOpen);
    gBrowser.tabContainer.removeEventListener("TabClose", this._onTabClose);
    gBrowser.tabContainer.removeEventListener("TabSelect", this._onTabSelect);
    gBrowser.tabContainer.removeEventListener("TabMove", this._onTabMove);
    gBrowser.tabContainer.removeEventListener(
      "TabAttrModified",
      this._onTabAttrModified
    );
    gBrowser.tabContainer.removeEventListener(
      "mousedown",
      this._onTabMouseDown,
      true
    );
    gBrowser.tabContainer.removeEventListener(
      "dragover",
      this._onTabStripDragOver,
      true
    );
    gBrowser.tabContainer.removeEventListener(
      "dragleave",
      this._onTabStripDragLeave,
      true
    );
    gBrowser.tabContainer.removeEventListener(
      "drop",
      this._onTabStripDrop,
      true
    );
    window.removeEventListener("mouseup", this._onTabMouseUp, true);
    window.removeEventListener("dragstart", this._onDragStart, true);
    window.removeEventListener("dragend", this._onDragEnd, true);
    this.menu.removeEventListener("popupshowing", this._onPopupShowing);
    this._initialized = false;
  },

  _clearTabStripDropIndicator() {
    let ind = gBrowser.tabContainer._tabDropIndicator;
    if (ind) {
      ind.hidden = true;
    }
  },

  _updateTabStripDropIndicator(event) {
    let ind = gBrowser.tabContainer._tabDropIndicator;

    if (!ind) {
      return;
    }

    let arrowScrollbox = gBrowser.tabContainer.arrowScrollbox;

    if (!arrowScrollbox) {
      return;
    }

    let isVertical = gBrowser.tabContainer.getAttribute("orient") == "vertical";
    let rect = arrowScrollbox.getBoundingClientRect();
    let targetTab = event.target.closest("tab, .tabbrowser-tab");
    let newMargin = 0;

    if (targetTab) {
      let tabRect = targetTab.getBoundingClientRect();

      if (isVertical) {
        let dropBefore = event.clientY < tabRect.top + tabRect.height / 2;
        newMargin = (dropBefore ? tabRect.top : tabRect.bottom) - rect.top;
      } 
      else {
        let dropBefore = event.clientX < tabRect.left + tabRect.width / 2;
        newMargin = (dropBefore ? tabRect.left : tabRect.right) - rect.left;
      }

    } 
    
    else {
      let lastTab = gBrowser.visibleTabs.at(-1);
      if (lastTab) {
        let lastRect = lastTab.getBoundingClientRect();
        newMargin = isVertical
          ? lastRect.bottom - rect.top
          : lastRect.right - rect.left;
      }
    }

    ind.hidden = false;
    ind.style.transform = isVertical ? "translateY(" + Math.round(newMargin) + "px)" : "translateX(" + Math.round(newMargin) + "px)";
  },

  activeStackTabs() {
    let selectedStack = this.stackTabs(gBrowser.selectedTab);
    if (selectedStack.length >= 2 && !this.isCollapsed(selectedStack[0])) {
      return selectedStack;
    }
    return [];
  },

  isTabDrag(event) {
    if (this._draggedStackTab || this._draggedExternalTab) {
      return true;
    }

    let dt = event?.dataTransfer;
    if (!dt) {
      return false;
    }

    const TAB_DROP_TYPE = "application/x-moz-tabbrowser-tab";
    if (dt.types) {

      if (
        typeof dt.types.includes === "function" &&
        dt.types.includes(TAB_DROP_TYPE)
      ) {
        return true;
      }

      if (
        typeof dt.types.contains === "function" &&
        dt.types.contains(TAB_DROP_TYPE)
      ) {
        return true;
      }

    }


    try {
      if (dt.mozItemCount > 0) {
        let types = dt.mozTypesAt(0);
        if (
          types &&
          (types.contains?.(TAB_DROP_TYPE) || types.includes?.(TAB_DROP_TYPE))
        ) {
          return true;
        }
      }
    } 
    catch (e) {}
    return false;
  },

  getDraggedTab(event) {
    if (this._draggedStackTab) {
      return this._draggedStackTab;
    }

    if (this._draggedExternalTab) {
      return this._draggedExternalTab;
    }

    let dt = event?.dataTransfer;
    if (!dt) {
      return null;
    }

    const TAB_DROP_TYPE = "application/x-moz-tabbrowser-tab";
    try {
      let tab = dt.mozGetDataAt(TAB_DROP_TYPE, 0);
      if (tab) {
        return tab;
      }
    } 
    catch (e) {}

    try {
      if (dt.mozItemCount > 0) {
        let tab = dt.mozGetDataAt(TAB_DROP_TYPE, 0);
        if (tab) {
          return tab;
        }
      }
    } 
    catch (e) {}
    return null;
  },

  tabs() {
    return [...gBrowser.tabs].filter(tab => !tab.closing);
  },

  stackId(tab) {
    return this.SessionStore.getCustomTabValue(tab, this.STACK_KEY);
  },

  setStack(tab, stackId) {
    
    if (stackId) {
      this.SessionStore.setCustomTabValue(tab, this.STACK_KEY, stackId);
    } 
    
    else {
      this.SessionStore.deleteCustomTabValue(tab, this.STACK_KEY);
    }
  },

  addToSourceStack(tab, sourceTab) {
    let sourceStackId = this.stackId(sourceTab);
    if (!sourceStackId || this.stackId(tab) || tab.pinned || tab == sourceTab) {
      return;
    }

    let lastInStack = this.stackTabs(sourceTab).at(-1);
    if (!lastInStack) {
      return;
    }
    this.setStack(tab, sourceStackId);
    gBrowser.moveTabAfter(tab, lastInStack);

    if (!tab.hasAttribute("fadein")) {
      let observer = new MutationObserver(() => {
        if (tab.hasAttribute("fadein")) {
          observer.disconnect();
          this.refresh();
        }
      });
      observer.observe(tab, { attributes: true, attributeFilter: ["fadein"] });
    }
  },

  openTabInActiveStack() {
    if (!this.activeStackTabs().length) {
      return;
    }

    openTrustedLinkIn(BROWSER_NEW_TAB_URL, "tab", {
      relatedToCurrent: true,
      inBackground: false,
    });
  },

  stackTabs(tab) {
    let stackId = this.stackId(tab);
    return stackId
      ? this.tabs().filter(candidate => this.stackId(candidate) == stackId)
      : [];
  },

  currentStackTab(stack) {
    return (
      stack.find(tab => tab.selected) ||
      stack.find(tab => tab == this._lastSelectedTabs.get(this.stackId(tab))) ||
      stack[0]
    );
  },

  isParent(tab) {
    let stack = this.stackTabs(tab);
    if (stack.length < 2) return false;
    return tab === this.currentStackTab(stack);
  },

  isChild(tab) {
    let stack = this.stackTabs(tab);
    if (stack.length < 2) return false;
    return tab !== this.currentStackTab(stack);
  },

  stack(tab, parent) {
    if (
      !tab ||
      !parent ||
      tab == parent ||
      tab.pinned ||
      parent.pinned
    ) {
      return;
    }

    let tabStackId = this.stackId(tab);
    let parentStackId = this.stackId(parent);

    if (tabStackId && tabStackId == parentStackId) {
      return;
    }

    let movingTabs = this.stackTabs(tab);

    if (!movingTabs.length) {
      movingTabs = [tab];
    }
    let targetTabs = this.stackTabs(parent);

    if (!targetTabs.length) {
      targetTabs = [parent];
    }

    let stackId = parentStackId || Services.uuid.generateUUID().toString();


    for (let stackTab of targetTabs) {
      this.setStack(stackTab, stackId);
    }

    for (let movingTab of movingTabs) {
      this.setStack(movingTab, stackId);
    }


    gBrowser.moveTabsAfter(movingTabs, targetTabs.at(-1));
    this.refresh();
  },

  unstack(tab) {
    if (!this.isChild(tab)) {
      return;
    }
    this.setStack(tab, "");
    this.SessionStore.deleteCustomTabValue(tab, this.COLLAPSED_KEY);
    this.refresh();
  },

  isCollapsed(tab) {
    return (
      this.SessionStore.getCustomTabValue(tab, this.COLLAPSED_KEY) == "true"
    );
  },

  toggle(tab) {
    let stack = this.stackTabs(tab);

    if (stack.length < 2) {
      return;
    }

    let collapsed = !this.isCollapsed(stack[0]);

    if (collapsed && stack.includes(gBrowser.selectedTab) && tab != gBrowser.selectedTab) {
      gBrowser.selectedTab = tab;
    }

    for (let stackTab of stack) {
      if (collapsed) {
        this.SessionStore.setCustomTabValue(stackTab, this.COLLAPSED_KEY, "true");
      } 
      else {
        this.SessionStore.deleteCustomTabValue(stackTab, this.COLLAPSED_KEY);
      }
    }
    this.refresh();
  },

  expandStack(tab) {
    let stack = this.stackTabs(tab);
    if (stack.length && this.isCollapsed(stack[0])) {
      for (let stackTab of stack) {
        this.SessionStore.deleteCustomTabValue(stackTab, this.COLLAPSED_KEY);
      }
    }
  },

  /**
   * Move a tab within its stack to a new position relative to a target tab.
   * @param {MozTabbrowserTab} tab - The tab to move.
   * @param {MozTabbrowserTab} targetTab - The tab to position relative to.
   * @param {boolean} before - If true, place before targetTab; otherwise after.
   */
  moveInStack(tab, targetTab, before = false) {
    if (!tab || !targetTab || tab === targetTab) {
      return;
    }
    let tabStackId = this.stackId(tab);
    let targetStackId = this.stackId(targetTab);
    if (!tabStackId || tabStackId !== targetStackId) {
      return;
    }
    if (before) {
      gBrowser.moveTabBefore(tab, targetTab);
    } else {
      gBrowser.moveTabAfter(tab, targetTab);
    }
    this.refresh();
  },

  moveStack(tab, targetTab, before = false) {
    let movingTabs = this.stackTabs(tab);
    if (!movingTabs.length || !targetTab || movingTabs.includes(targetTab)) {
      return;
    }

    let targetTabs = this.stackTabs(targetTab);
    targetTab = targetTabs.length ? targetTabs[before ? 0 : targetTabs.length - 1] : targetTab;

    if (before) {
      gBrowser.moveTabsBefore(movingTabs, targetTab);
    } else {
      gBrowser.moveTabsAfter(movingTabs, targetTab);
    }
  },

  updateMenu() {
    let tab = TabContextMenu.contextTab;
    let parent = gBrowser.selectedTab;
    let tabStackId = tab && this.stackId(tab);
    let parentStackId = parent && this.stackId(parent);

    let canStack =
      tab &&
      parent &&
      !TabContextMenu.multiselected &&
      tab != parent &&
      !tab.pinned &&
      !parent.pinned &&
      (!tabStackId || tabStackId != parentStackId);


    let stack = document.getElementById("context_StackUnderActive");
    let unstack = document.getElementById("context_Unstack");
    let toggle = document.getElementById("context_ToggleStack");
    let separator = document.getElementById("context_StackSeparator");

    stack.hidden = !canStack;
    unstack.hidden = !this.isChild(tab) || TabContextMenu.multiselected;
    toggle.hidden = !this.isParent(tab);
    toggle.label = this.isCollapsed(tab)
      ? "Expand Tab Stack"
      : "Collapse Tab Stack";
    separator.hidden = stack.hidden && unstack.hidden && toggle.hidden;
  },

  createStackBarTab(tab) {
    let button = document.createXULElement("toolbarbutton");
    button.className = "toolbarbutton-1 tabbrowser-tab tab-stack-tab";
    button.setAttribute("context", "tabContextMenu");
    button.setAttribute("role", "tab");
    button.setAttribute("label", tab.label);
    button.setAttribute("tooltiptext", tab.label);
    button.setAttribute("fadein", "");
    button.setAttribute("aria-selected", tab.selected);
    button.toggleAttribute("selected", tab.selected);
    button.toggleAttribute(
      "visuallyselected",
      tab.hasAttribute("visuallyselected")
    );
    button.tab = tab;
    button.setAttribute("draggable", "true");

    let tabStack = tab.querySelector(".tab-stack").cloneNode(true);
    tabStack.querySelector(".tab-stack-count")?.remove();
    button.append(tabStack);
    button.addEventListener("mousedown", event => event.stopPropagation());
    button.addEventListener("dblclick", event => {
      event.preventDefault();
      event.stopPropagation();
    });

    button.addEventListener("click", event => {
      event.stopPropagation();

      if (event.target.closest(".tab-close-button")) {
        button._closeRequested = true;
        gBrowser.removeTab(tab);
      }
    });

    button.addEventListener("command", event => {
      event.stopPropagation();
      if (!button._closeRequested && !tab.closing) {
        gBrowser.selectedTab = tab;
      }
    });

    // reordering within the stack bar or dragging from regular tab bar
    button.addEventListener("dragstart", event => {
      event.stopPropagation();
      this._draggedStackTab = tab;
      this._draggedButton = button;
      this._isDraggingTab = true;
      button.toggleAttribute("stack-dragging", true);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/x-tab-stack-drag", "true");
      try {
        event.dataTransfer.mozSetDataAt(
          "application/x-moz-tabbrowser-tab",
          tab,
          0
        );
        event.dataTransfer.mozSetDataAt(
          "text/x-moz-text-internal",
          tab.linkedBrowser?.currentURI?.spec || "",
          0
        );
      } 
      catch (e) {}
    });

    button.addEventListener("dragover", event => {
      if (!this.isTabDrag(event)) {
        return;
      }
      let draggedTab = this.getDraggedTab(event);
      if (draggedTab) {
        if ( draggedTab === tab || draggedTab.pinned || draggedTab.closing) {
          return;
        }
      }
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      this._isDraggingTab = true;

      let rect = button.getBoundingClientRect();
      let midX = rect.left + rect.width / 2;
      let dropBefore = event.clientX < midX;

      let row = button.closest(".tab-stack-bar-row");
      if (row) {
        for (let child of row.children) {
          child.removeAttribute("stack-drop-before");
          child.removeAttribute("stack-drop-after");
        }
      }

      button.toggleAttribute("stack-drop-before", dropBefore);
      button.toggleAttribute("stack-drop-after", !dropBefore);
    });

    button.addEventListener("dragleave", event => {
      event.stopPropagation();
      button.removeAttribute("stack-drop-before");
      button.removeAttribute("stack-drop-after");
    });

    button.addEventListener("drop", event => {
      let draggedTab = this.getDraggedTab(event);
      if ( !draggedTab || draggedTab === tab || draggedTab.pinned || draggedTab.closing ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      let rect = button.getBoundingClientRect();
      let midX = rect.left + rect.width / 2;
      let dropBefore = event.clientX < midX;

      button.removeAttribute("stack-drop-before");
      button.removeAttribute("stack-drop-after");

      if (this.stackId(draggedTab) === this.stackId(tab)) {
        this.moveInStack(draggedTab, tab, dropBefore);
      } 
      else {
        let targetStackId = this.stackId(tab);
        let movingTabs = this.stackTabs(draggedTab);
        if (!movingTabs.length) {
          movingTabs = [draggedTab];
        }

        for (let movingTab of movingTabs) {
          this.setStack(movingTab, targetStackId);
        }

        if (dropBefore) {
          gBrowser.moveTabsBefore(movingTabs, tab);
        } 
        else {
          gBrowser.moveTabsAfter(movingTabs, tab);
        }

        this.refresh();
      }

      this._draggedStackTab = null;
      this._draggedExternalTab = null;
      this._draggedButton = null;
      this._isDraggingTab = false;
      this._mouseDownOnTab = false;
    });

    button.addEventListener("dragend", event => {
      event.stopPropagation();
      button.removeAttribute("stack-dragging");
      // clear remaining indicators if any
      let row = button.closest(".tab-stack-bar-row");
      if (row) {
        for (let child of row.children) {
          child.removeAttribute("stack-drop-before");
          child.removeAttribute("stack-drop-after");
          child.removeAttribute("stack-dragging");
        }
      }
      this._draggedStackTab = null;
      this._draggedExternalTab = null;
      this._draggedButton = null;
      this._isDraggingTab = false;
      this._mouseDownOnTab = false;
      this.refresh();
    });

    return button;
  },

  createStackBarNewTabButton() {
    let button = document.createXULElement("toolbarbutton");
    button.className = "toolbarbutton-1 tab-stack-newtab-button";
    document.l10n.setAttributes(button, "tabs-toolbar-new-tab");
    button.addEventListener("click", event => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      this.openTabInActiveStack();
    });
    return button;
  },

  _setupStackBarRowDnd(row) {
    row.addEventListener("dragover", event => {
      if (event.target.closest(".tab-stack-tab")) {
        return;
      }
      if (!this.isTabDrag(event)) {
        return;
      }

      let draggedTab = this.getDraggedTab(event);
      if (draggedTab) {
        if (draggedTab.pinned || draggedTab.closing) {
          return;
        }
      }
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      this._isDraggingTab = true;

      let tabs = row.querySelectorAll(".tab-stack-tab");
      for (let child of tabs) {
        child.removeAttribute("stack-drop-before");
        child.removeAttribute("stack-drop-after");
      }

      if (tabs.length) {
        tabs[tabs.length - 1].toggleAttribute("stack-drop-after", true);
      }
    });

    row.addEventListener("dragleave", event => {
      if (event.target.closest(".tab-stack-tab")) {
        return;
      }
      let related = event.relatedTarget;

      if (!row.contains(related)) {
        for (let child of row.querySelectorAll(".tab-stack-tab")) {
          child.removeAttribute("stack-drop-before");
          child.removeAttribute("stack-drop-after");
        }
      }
    });

    row.addEventListener("drop", event => {
      if (event.target.closest(".tab-stack-tab")) {
        return;
      }

      let draggedTab = this.getDraggedTab(event);
      if (!draggedTab || draggedTab.pinned || draggedTab.closing) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      for (let child of row.querySelectorAll(".tab-stack-tab")) {
        child.removeAttribute("stack-drop-before");
        child.removeAttribute("stack-drop-after");
      }

      let activeStack = this.activeStackTabs();
      if (!activeStack.length) {
        let firstTab = row.querySelector(".tab-stack-tab")?.tab;
        if (firstTab) {
          activeStack = this.stackTabs(firstTab);
        }
      }
      if (!activeStack.length) {
        return;
      }

      let targetStackId = this.stackId(activeStack[0]);
      let lastTab = activeStack.at(-1);

      if (this.stackId(draggedTab) === targetStackId) {
        if (draggedTab !== lastTab) {
          this.moveInStack(draggedTab, lastTab, false);
        }
      } 
      else {
        let movingTabs = this.stackTabs(draggedTab);
        if (!movingTabs.length) {
          movingTabs = [draggedTab];
        }
        for (let movingTab of movingTabs) {
          this.setStack(movingTab, targetStackId);
        }
        gBrowser.moveTabsAfter(movingTabs, lastTab);
        this.refresh();
      }

      this._draggedStackTab = null;
      this._draggedExternalTab = null;
      this._draggedButton = null;
      this._isDraggingTab = false;
      this._mouseDownOnTab = false;
    });
  },

  renderStackBars() {
    let bar = document.getElementById("tab-stack-bars");
    let container = document.getElementById("tab-stack-bars-container");

    if (!bar || !container) {
      return;
    }

    let stack =
      gBrowser.tabContainer.getAttribute("orient") == "horizontal"
        ? this.activeStackTabs()
        : [];
    if (stack.length < 2 || this.isCollapsed(stack[0])) {
      stack = [];
    }

    bar.hidden = !stack.length;
    if (!stack.length) {
      container.replaceChildren();
      return;
    }

    let row = document.createXULElement("hbox");

    row.className = "tab-stack-bar-row";
    row.setAttribute("role", "tablist");
    row.append(
      ...stack.map(tab => this.createStackBarTab(tab)),
      this.createStackBarNewTabButton()
    );
    this._setupStackBarRowDnd(row);
    
    container.replaceChildren(row);
  },

  refresh() {
    let stacks = new Map();

    for (let tab of this.tabs()) {
      tab.toggleAttribute("stack-child", false);
      tab.toggleAttribute("stack-hidden", false);
      tab.toggleAttribute("stack-current", false);
      tab.toggleAttribute("stack-collapsed", false);
      tab.style.setProperty("--stack-depth", 0);
      delete tab.dataset.stackTabCount;
      let existingBadge = tab.querySelector(".tab-stack-count");
      if (existingBadge) existingBadge.remove();

      let stackId = this.stackId(tab);

      if (stackId) {
        if (!stacks.has(stackId)) {
          stacks.set(stackId, []);
        }

        stacks.get(stackId).push(tab);
      }
    }

    for (let stack of stacks.values()) {
      if (stack.length < 2) {
        this.setStack(stack[0], "");
        this.SessionStore.deleteCustomTabValue(stack[0], this.COLLAPSED_KEY);
        continue;
      }

      let collapsed = this.isCollapsed(stack[0]);
      let currentTab = this.currentStackTab(stack);
      for (let tab of stack) {
        let isCurrent = tab === currentTab;
        tab.toggleAttribute("stack-child", !isCurrent);
        tab.toggleAttribute("stack-hidden", !isCurrent && collapsed);
        tab.toggleAttribute("stack-current", isCurrent);
        tab.toggleAttribute("stack-collapsed", isCurrent && collapsed);
        tab.style.setProperty("--stack-depth", isCurrent ? 0 : 1);
        if (isCurrent) {
          tab.dataset.stackTabCount = stack.length;
          let closeBtn = tab.querySelector(".tab-close-button");
          if (closeBtn) {
            let badge = document.createElement("span");
            badge.className = "tab-stack-count";
            badge.textContent = stack.length;
            closeBtn.parentNode.insertBefore(badge, closeBtn);
          }
        }
      }

    }
    this.renderStackBars();
  },
};

    const updateToolbarOpacity = () => {
      const val = Services.prefs.getIntPref("simple.theme.transparent-toolbar.opacity", 55);
      document.documentElement.style.setProperty("--simple-toolbar-opacity", val + "%");
      document.documentElement.style.setProperty("--toolbar-opacity", val + "%");
      document.documentElement.style.setProperty("--simple-urlbar-opacity", Math.min(100, val + 15) + "%");
      document.documentElement.style.setProperty("--urlbar-opacity", Math.min(100, val + 15) + "%");
    };

    
    updateToolbarOpacity();
    Services.prefs.addObserver("simple.theme.transparent-toolbar.opacity", updateToolbarOpacity);
    window.addEventListener(
      "unload",
      () => {
        Services.prefs.removeObserver(
          "simple.theme.transparent-toolbar.opacity",
          updateToolbarOpacity
        );
      },
      { once: true }
    );

