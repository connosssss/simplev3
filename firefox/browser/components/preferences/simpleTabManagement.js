/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

"use strict";

/* global Preferences */

var gSimpleTabManagementPane = {
  init() {
    Preferences.addAll([
      { id: "simple.tabs.hibernate.enabled", type: "bool" },
      { id: "simple.tabs.hibernate.timeout_minutes", type: "int" },
    ]);

    const enabledPref = Preferences.get("simple.tabs.hibernate.enabled");
    const timeoutBox = document.getElementById(
      "simpleTabHibernationTimeoutBox"
    );
    const protectionDescription = document.getElementById(
      "simpleTabHibernationProtection"
    );

    const updateHibernationUI = () => {
      timeoutBox.hidden = !enabledPref.value;
      protectionDescription.hidden = !enabledPref.value;
    };

    enabledPref.on("change", updateHibernationUI);
    updateHibernationUI();

    this._tabList = document.getElementById("simpleTabList");
    this._browserWindow = window.browsingContext.topChromeWindow;
    this._tabContainer = this._browserWindow.gBrowser.tabContainer;
    this._collapsedStacks = new Set();
    this._scheduleTabListUpdate = () => {
      if (!this._tabListUpdatePending) {
        this._tabListUpdatePending = true;
        queueMicrotask(() => {
          this._tabListUpdatePending = false;
          this._renderTabList();
        });
      }
    };
    this._tabEvents = [
      "TabOpen",
      "TabClose",
      "TabMove",
      "TabSelect",
      "TabAttrModified",
      "TabPinned",
      "TabUnpinned",
      "TabBrowserDiscarded",
    ];
    for (const eventName of this._tabEvents) {
      this._tabContainer.addEventListener(
        eventName,
        this._scheduleTabListUpdate
      );
    }
    window.addEventListener("unload", () => this._uninit(), { once: true });
    this._renderTabList();
  },

  _uninit() {
    for (const eventName of this._tabEvents || []) {
      this._tabContainer.removeEventListener(
        eventName,
        this._scheduleTabListUpdate
      );
    }
  },

  _renderTabList() {
    const tabs = [...this._browserWindow.gBrowser.tabs].filter(
      tab => !tab.closing
    );
    const stacks = new Map();
    const unstackedTabs = [];

    for (const tab of tabs) {
      const stackId = this._browserWindow.TabStacks?.stackId(tab);
      if (stackId) {
        if (!stacks.has(stackId)) {
          stacks.set(stackId, []);
        }
        stacks.get(stackId).push(tab);
      } else {
        unstackedTabs.push(tab);
      }
    }

    const fragment = document.createDocumentFragment();
    let stackNumber = 0;
    for (const [stackId, stack] of stacks) {
      if (stack.length < 2) {
        unstackedTabs.push(...stack);
        continue;
      }
      stackNumber++;
      const collapsed = this._collapsedStacks.has(stackId);
      fragment.appendChild(
        this._createStackHeader(stack, stackNumber, stackId, collapsed)
      );
      if (!collapsed) {
        for (const tab of stack) {
          fragment.appendChild(this._createTabRow(tab, true));
        }
      }
    }

    if (unstackedTabs.length) {
      if (stackNumber) {
        fragment.appendChild(this._createSectionLabel("Other tabs"));
      }
      for (const tab of unstackedTabs) {
        fragment.appendChild(this._createTabRow(tab, false));
      }
    }

    this._tabList.replaceChildren(fragment);
  },

  _createStackHeader(stack, number, stackId, collapsed) {
    const hibernated = stack.filter(tab => this._isHibernated(tab)).length;
    const toggle = document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "button"
    );
    toggle.className = "simple-tab-stack-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", String(!collapsed));
    const chevron = document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "span"
    );
    chevron.className = "simple-tab-stack-chevron";
    chevron.textContent = collapsed ? "▸" : "▾";
    const label = document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "span"
    );
    label.className = "simple-tab-stack-name";
    label.textContent = `Stack ${number}`;
    const count = document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "span"
    );
    count.className = "simple-tab-stack-count";
    count.textContent = `${stack.length} tabs${
      hibernated ? ` · ${hibernated} hibernated` : ""
    }`;
    toggle.append(chevron, label, count);
    toggle.addEventListener("click", () => {
      if (this._collapsedStacks.has(stackId)) {
        this._collapsedStacks.delete(stackId);
      } else {
        this._collapsedStacks.add(stackId);
      }
      this._renderTabList();
    });
    return toggle;
  },

  _isHibernated(tab) {
    return tab.hasAttribute("discarded") || tab.hasAttribute("pending");
  },

  _createSectionLabel(value) {
    const label = document.createXULElement("label");
    label.setAttribute("value", value);
    label.className = "simple-tab-section-label";
    return label;
  },

  _createTabRow(tab, inStack) {
    const isHibernated = this._isHibernated(tab);
    const row = document.createXULElement("hbox");
    row.className = "simple-tab-row";
    row.setAttribute("align", "center");
    row.setAttribute("role", "listitem");
    row.toggleAttribute("data-in-stack", inStack);
    row.toggleAttribute("data-hibernated", isHibernated);

    const icon = document.createXULElement("image");
    icon.className = "simple-tab-icon";
    if (tab.image) {
      icon.setAttribute("src", tab.image);
    }
    row.appendChild(icon);

    const title = document.createXULElement("label");
    title.setAttribute("value", tab.label || "New Tab");
    title.setAttribute("crop", "end");
    title.setAttribute("flex", "1");
    title.className = "simple-tab-title";
    row.appendChild(title);

    const state = document.createXULElement("label");
    state.className = "simple-tab-state";
    if (isHibernated) {
      state.setAttribute("value", "Hibernated");
      state.setAttribute("data-hibernated", "true");
      state.setAttribute(
        "tooltiptext",
        "Hibernated tab. Select Wake to reload it."
      );
    } else if (tab.selected) {
      state.setAttribute("value", "Active");
    }
    row.appendChild(state);

    const action = document.createXULElement("button");
    action.className = "simple-tab-action";
    if (isHibernated) {
      action.setAttribute("label", "Wake");
      action.addEventListener("command", () => {
        this._browserWindow.gBrowser.selectedTab = tab;
      });
    } else {
      const canHibernate = !tab.selected;
      action.setAttribute("label", "Hibernate");
      action.disabled = !canHibernate;
      if (!canHibernate) {
        action.setAttribute(
          "tooltiptext",
          "The active tab cannot be hibernated."
        );
      }
      action.addEventListener("command", async () => {
        action.disabled = true;
        action.setAttribute("label", "Hibernating…");
        try {
          await this._browserWindow.gBrowser.prepareDiscardBrowser(tab);
          this._browserWindow.gBrowser.discardBrowser(tab, true);
        } catch (error) {
          console.error("Unable to hibernate tab", error);
        } finally {
          this._renderTabList();
        }
      });
    }
    row.appendChild(action);
    return row;
  },
};
