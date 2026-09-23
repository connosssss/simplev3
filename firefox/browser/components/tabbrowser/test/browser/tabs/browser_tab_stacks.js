/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

 // testing is automated

add_task(async function test_tab_stacks() {
  let parent = BrowserTestUtils.addTab(gBrowser, "about:blank");
  let child = BrowserTestUtils.addTab(gBrowser, "about:blank");
  let grandchild = BrowserTestUtils.addTab(gBrowser, "about:blank");

  TabStacks.stack(child, parent);
  TabStacks.stack(grandchild, child);
  Assert.ok(child.hasAttribute("stack-child"), "child is stacked");
  Assert.equal(
    child.style.getPropertyValue("--stack-depth"),
    "1",
    "child is one level deep"
  );
  Assert.equal(
    grandchild.style.getPropertyValue("--stack-depth"),
    "1",
    "stack members share one depth"
  );

  TabStacks.toggle(parent);
  Assert.ok(
    child.hasAttribute("stack-hidden"),
    "collapsing a parent hides its descendants"
  );
  gBrowser.selectedTab = grandchild;
  Assert.ok(
    !parent.hasAttribute("stack-collapsed"),
    "selecting a stack member expands its stack"
  );

  BrowserTestUtils.removeTab(parent);
  Assert.ok(
    child.hasAttribute("stack-current"),
    "closing the current tab promotes the next stack member"
  );
  Assert.ok(
    grandchild.hasAttribute("stack-child"),
    "the other member remains a child"
  );

  TabStacks.unstack(grandchild);
  Assert.ok(
    !grandchild.hasAttribute("stack-child"),
    "unstack removes the child from its stack"
  );
  BrowserTestUtils.removeTab(grandchild);
  BrowserTestUtils.removeTab(child);
});


add_task(async function test_active_stack_gets_a_stack_bar() {
  let parent = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    skipAnimation: true,
  });
  let child = BrowserTestUtils.addTab(gBrowser, "about:config", {
    skipAnimation: true,
  });
  TabStacks.stack(child, parent);
  gBrowser.selectedTab = parent;

  let bar = document.getElementById("tab-stack-bars");
  let container = document.getElementById("tab-stack-bars-container");
  await TestUtils.waitForCondition(
    () =>
      !bar.hidden && container.querySelectorAll(".tab-stack-tab").length == 2,
    "The active stack's tabs are shown in a stack bar"
  );
  Assert.equal(
    container.querySelector(".tab-stack-tab > .tab-stack").tagName,
    "stack",
    "The stack bar uses the regular tab visual structure"
  );
  Assert.equal(
    getComputedStyle(child).display,
    "none",
    "Stack children are not shown in the outer tab bar"
  );
  Assert.deepEqual(
    Array.from(
      container.querySelectorAll(".tab-stack-tab"),
      button => button.getAttribute("label")
    ),
    [parent.label, child.label],
    "The stack bar preserves the stack's tab order"
  );

  let selectChild = BrowserTestUtils.waitForEvent(
    gBrowser.tabContainer,
    "TabSelect"
  );
  EventUtils.synthesizeMouseAtCenter(
    container.querySelectorAll(".tab-stack-tab")[1],
    {},
    window
  );
  await selectChild;
  Assert.equal(
    gBrowser.selectedTab,
    child,
    "A stack-bar tab selects its real tab"
  );

  TabStacks.toggle(parent);
  await TestUtils.waitForCondition(
    () => bar.hidden,
    "Collapsing the stack hides its stack bar"
  );

  TabStacks.toggle(parent);
  BrowserTestUtils.removeTab(child);
  BrowserTestUtils.removeTab(parent);
});

add_task(async function test_stack_bar_new_tab_button_adds_to_active_stack() {
  let parent = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    skipAnimation: true,
  });
  let child = BrowserTestUtils.addTab(gBrowser, "about:config", {
    skipAnimation: true,
  });
  TabStacks.stack(child, parent);
  gBrowser.selectedTab = parent;

  let bar = document.getElementById("tab-stack-bars");
  let container = document.getElementById("tab-stack-bars-container");
  await TestUtils.waitForCondition(
    () => !bar.hidden,
    "The stack bar is visible before opening a tab"
  );

  let button = container.querySelector(".tab-stack-newtab-button");
  is(
    button,
    container.lastElementChild.lastElementChild,
    "The button follows the stack tabs"
  );

  let nativeButton = document.getElementById("tabs-newtab-button");
  let newTabPromise = BrowserTestUtils
    .waitForEvent(gBrowser.tabContainer, "TabOpen")
    .then(event => event.target);
  EventUtils.synthesizeMouseAtCenter(nativeButton, {}, window);
  let newTab = await newTabPromise;

  await TestUtils.waitForCondition(
    () => container.querySelectorAll(".tab-stack-tab").length == 3,
    "The new tab is immediately rendered in the stack bar"
  );
  await TestUtils.waitForCondition(
    () => {
      let stackTab = container.querySelectorAll(".tab-stack-tab")[2];
      return (
        stackTab.getAttribute("label") == newTab.label &&
        stackTab.querySelector(".tab-label").textContent == newTab.label &&
        stackTab.querySelector(".tab-icon-image").hasAttribute("fadein") &&
        stackTab.querySelector(".tab-close-button").hasAttribute("fadein")
      );
    },
    "The new tab's label, favicon, and close button render after its fade-in"
  );
  is(
    TabStacks.stackId(newTab),
    TabStacks.stackId(parent),
    "The new tab joins the active stack"
  );
  is(gBrowser.selectedTab, newTab, "The new tab is selected");
  is(
    TabStacks.stackTabs(parent).at(-1),
    newTab,
    "The new tab is appended to the stack"
  );

  BrowserTestUtils.removeTab(newTab);
  BrowserTestUtils.removeTab(child);
  BrowserTestUtils.removeTab(parent);
});

add_task(async function test_stack_bar_hides_outside_active_stack() {
  let parent = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    skipAnimation: true,
  });
  let child = BrowserTestUtils.addTab(gBrowser, "about:config", {
    skipAnimation: true,
  });
  let regularTab = BrowserTestUtils.addTab(gBrowser, "about:robots", {
    skipAnimation: true,
  });
  let originalOrientation = gBrowser.tabContainer.getAttribute("orient");
  let bar = document.getElementById("tab-stack-bars");

  try {
    gBrowser.tabContainer.setAttribute("orient", "horizontal");
    TabStacks.stack(child, parent);
    gBrowser.selectedTab = parent;
    await TestUtils.waitForCondition(
      () => !bar.hidden,
      "The active stack's tab bar is shown"
    );

    // A pending mouse/drag state must not keep the previous stack bar visible.
    TabStacks._isDraggingTab = true;
    TabStacks._mouseDownOnTab = true;
    gBrowser.selectedTab = regularTab;
    TabStacks.renderStackBars();
    Assert.ok(bar.hidden, "The stack bar hides when a regular tab is selected");
  } finally {
    TabStacks._isDraggingTab = false;
    TabStacks._mouseDownOnTab = false;
    if (originalOrientation) {
      gBrowser.tabContainer.setAttribute("orient", originalOrientation);
    } else {
      gBrowser.tabContainer.removeAttribute("orient");
    }
  }

  BrowserTestUtils.removeTab(regularTab);
  BrowserTestUtils.removeTab(child);
  BrowserTestUtils.removeTab(parent);
});

add_task(async function test_stack_remembers_its_last_selected_tab() {
  let firstParent = BrowserTestUtils.addTab(gBrowser, "about:blank");
  let firstChild = BrowserTestUtils.addTab(gBrowser, "about:config");
  let secondParent = BrowserTestUtils.addTab(gBrowser, "about:robots");
  let secondChild = BrowserTestUtils.addTab(gBrowser, "about:mozilla");
  let regularTab = BrowserTestUtils.addTab(gBrowser, "about:license");

  TabStacks.stack(firstChild, firstParent);
  TabStacks.stack(secondChild, secondParent);
  gBrowser.selectedTab = firstChild;

  gBrowser.selectedTab = secondParent;
  Assert.ok(
    firstChild.hasAttribute("stack-current"),
    "Switching stacks keeps the last selected tab as the first stack's parent"
  );

  gBrowser.selectedTab = regularTab;
  Assert.ok(
    firstChild.hasAttribute("stack-current"),
    "Switching to a regular tab keeps the last selected stack tab as parent"
  );

  gBrowser.selectedTab = firstChild;
  Assert.equal(
    gBrowser.selectedTab,
    firstChild,
    "Returning to the stack selects the tab that was last active in it"
  );

  BrowserTestUtils.removeTab(regularTab);
  BrowserTestUtils.removeTab(secondChild);
  BrowserTestUtils.removeTab(secondParent);
  BrowserTestUtils.removeTab(firstChild);
  BrowserTestUtils.removeTab(firstParent);
});

add_task(async function test_only_related_tabs_join_active_stack() {
  let pageURL = getRootDirectory(gTestPath).replace(
    "chrome://mochitests/content",
    // eslint-disable-next-line @microsoft/sdl/no-insecure-url
    "http://example.com"
  );
  pageURL += "file_new_tab_page.html";

  let parent = await BrowserTestUtils.openNewForegroundTab(gBrowser, pageURL);
  let child = BrowserTestUtils.addTab(gBrowser, "about:config");
  TabStacks.stack(child, parent);
  let originalOrientation = gBrowser.tabContainer.getAttribute("orient");

  try {
    gBrowser.tabContainer.setAttribute("orient", "horizontal");
    gBrowser.selectedTab = parent;

    let newTabPromise = BrowserTestUtils
      .waitForEvent(gBrowser.tabContainer, "TabOpen")
      .then(event => event.target);
    BrowserCommands.openTab();
    let newTab = await newTabPromise;
    is(newTab.openerTab, null, "The new-tab button has no source tab");
    ok(!TabStacks.stackId(newTab), "The new-tab button opens outside a stack");
    BrowserTestUtils.removeTab(newTab);

    for (let click of [{ ctrlKey: true }, { button: 1 }]) {
      gBrowser.selectedTab = parent;
      let relatedTabPromise = BrowserTestUtils.waitForNewTab(
        gBrowser,
        // eslint-disable-next-line @microsoft/sdl/no-insecure-url
        "http://example.com/#linkclick",
        true
      );
      await BrowserTestUtils.synthesizeMouseAtCenter(
        "#link_to_example_com",
        click,
        parent.linkedBrowser
      );
      let relatedTab = await relatedTabPromise;
      is(relatedTab.openerTab, parent, "The link keeps its source tab");
      is(
        TabStacks.stackId(relatedTab),
        TabStacks.stackId(parent),
        "A Ctrl-clicked or middle-clicked link joins the horizontal stack"
      );
      BrowserTestUtils.removeTab(relatedTab);
    }
  } finally {
    if (originalOrientation) {
      gBrowser.tabContainer.setAttribute("orient", originalOrientation);
    } else {
      gBrowser.tabContainer.removeAttribute("orient");
    }
  }

  BrowserTestUtils.removeTab(child);
  BrowserTestUtils.removeTab(parent);
});

add_task(async function test_drag_tab_from_regular_tabbar_into_stack_tabbar() {
  let parent = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    skipAnimation: true,
  });
  let child = BrowserTestUtils.addTab(gBrowser, "about:config", {
    skipAnimation: true,
  });
  TabStacks.stack(child, parent);

  let originalOrientation = gBrowser.tabContainer.getAttribute("orient");
  gBrowser.tabContainer.setAttribute("orient", "horizontal");
  gBrowser.selectedTab = parent;

  let bar = document.getElementById("tab-stack-bars");
  let container = document.getElementById("tab-stack-bars-container");
  await TestUtils.waitForCondition(
    () =>
      !bar.hidden && container.querySelectorAll(".tab-stack-tab").length == 2,
    "The active stack's tabs are shown in a stack bar"
  );

  let externalTab = null;
  let externalTab2 = null;
  let externalTab3 = null;
  let pinnedTab = null;

  externalTab = BrowserTestUtils.addTab(gBrowser, "about:robots", {
    skipAnimation: true,
  });
  ok(!TabStacks.stackId(externalTab), "externalTab is initially not in a stack");

  try {
    // 1. Drop after a button in the stack bar
    let buttons = container.querySelectorAll(".tab-stack-tab");
    let targetButton = buttons[1]; // child button
    let rect = targetButton.getBoundingClientRect();
    EventUtils.synthesizeDrop(
      externalTab,
      targetButton,
      [[{ type: "application/x-moz-tabbrowser-tab", data: externalTab }]],
      "move",
      window,
      window,
      {
        clientX: rect.left + rect.width * 0.75,
        clientY: rect.top + rect.height / 2,
      }
    );

    await TestUtils.waitForCondition(
      () =>
        TabStacks.stackId(externalTab) == TabStacks.stackId(parent) &&
        container.querySelectorAll(".tab-stack-tab").length == 3,
      "externalTab joined the stack and is displayed in the stack bar"
    );

    Assert.deepEqual(
      TabStacks.stackTabs(parent),
      [parent, child, externalTab],
      "externalTab was inserted after the child tab"
    );

    // 2. Drop before the first button (becomes the new parent)
    externalTab2 = BrowserTestUtils.addTab(gBrowser, "about:mozilla", {
      skipAnimation: true,
    });
    let firstButton = container.querySelectorAll(".tab-stack-tab")[0];
    let rectFirst = firstButton.getBoundingClientRect();
    EventUtils.synthesizeDrop(
      externalTab2,
      firstButton,
      [[{ type: "application/x-moz-tabbrowser-tab", data: externalTab2 }]],
      "move",
      window,
      window,
      {
        clientX: rectFirst.left + rectFirst.width * 0.25,
        clientY: rectFirst.top + rectFirst.height / 2,
      }
    );

    await TestUtils.waitForCondition(
      () =>
        TabStacks.stackId(externalTab2) == TabStacks.stackId(parent) &&
        container.querySelectorAll(".tab-stack-tab").length == 4,
      "externalTab2 joined the stack at the beginning"
    );

    Assert.equal(
      TabStacks.stackTabs(parent)[0],
      externalTab2,
      "externalTab2 is now the first tab of the stack"
    );
    Assert.ok(
      externalTab2.hasAttribute("stack-current"),
      "externalTab2 is marked as stack current tab"
    );

    // 3. Drop onto empty area of stack bar row (appends to end)
    externalTab3 = BrowserTestUtils.addTab(gBrowser, "about:license", {
      skipAnimation: true,
    });
    let row = container.querySelector(".tab-stack-bar-row");
    let rowRect = row.getBoundingClientRect();
    EventUtils.synthesizeDrop(
      externalTab3,
      row,
      [[{ type: "application/x-moz-tabbrowser-tab", data: externalTab3 }]],
      "move",
      window,
      window,
      {
        clientX: rowRect.right - 5,
        clientY: rowRect.top + rowRect.height / 2,
      }
    );

    await TestUtils.waitForCondition(
      () =>
        TabStacks.stackId(externalTab3) == TabStacks.stackId(parent) &&
        container.querySelectorAll(".tab-stack-tab").length == 5,
      "externalTab3 joined the stack at the end via row drop"
    );

    Assert.equal(
      TabStacks.stackTabs(parent).at(-1),
      externalTab3,
      "externalTab3 was appended to the end of the stack"
    );

    // 4. Dropping a pinned tab is rejected
    pinnedTab = BrowserTestUtils.addTab(gBrowser, "about:config", {
      skipAnimation: true,
    });
    gBrowser.pinTab(pinnedTab);
    let newRow = container.querySelector(".tab-stack-bar-row");
    let newRowRect = newRow.getBoundingClientRect();
    EventUtils.synthesizeDrop(
      pinnedTab,
      newRow,
      [[{ type: "application/x-moz-tabbrowser-tab", data: pinnedTab }]],
      "move",
      window,
      window,
      {
        clientX: newRowRect.right - 5,
        clientY: newRowRect.top + newRowRect.height / 2,
      }
    );

    Assert.ok(!TabStacks.stackId(pinnedTab), "Pinned tab was not added to stack");
    Assert.equal(
      container.querySelectorAll(".tab-stack-tab").length,
      5,
      "Stack count remained unchanged after pinned tab drop attempt"
    );
  } finally {
    TabStacks._isDraggingTab = false;
    TabStacks._mouseDownOnTab = false;
    TabStacks._draggedStackTab = null;
    TabStacks._draggedExternalTab = null;
    if (pinnedTab) {
      BrowserTestUtils.removeTab(pinnedTab);
    }
    if (externalTab3) {
      BrowserTestUtils.removeTab(externalTab3);
    }
    if (externalTab2) {
      BrowserTestUtils.removeTab(externalTab2);
    }
    if (externalTab) {
      BrowserTestUtils.removeTab(externalTab);
    }
    if (originalOrientation) {
      gBrowser.tabContainer.setAttribute("orient", originalOrientation);
    } else {
      gBrowser.tabContainer.removeAttribute("orient");
    }
  }

  BrowserTestUtils.removeTab(child);
  BrowserTestUtils.removeTab(parent);
});

add_task(async function test_drag_tab_from_stack_tabbar_to_regular_tabbar() {
  let parent = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    skipAnimation: true,
  });
  let child1 = BrowserTestUtils.addTab(gBrowser, "about:config", {
    skipAnimation: true,
  });
  let child2 = BrowserTestUtils.addTab(gBrowser, "about:robots", {
    skipAnimation: true,
  });
  TabStacks.stack(child1, parent);
  TabStacks.stack(child2, child1);

  let originalOrientation = gBrowser.tabContainer.getAttribute("orient");
  gBrowser.tabContainer.setAttribute("orient", "horizontal");
  gBrowser.selectedTab = parent;

  let bar = document.getElementById("tab-stack-bars");
  let container = document.getElementById("tab-stack-bars-container");
  await TestUtils.waitForCondition(
    () =>
      !bar.hidden && container.querySelectorAll(".tab-stack-tab").length == 3,
    "The stack bar is shown with 3 tabs"
  );

  try {
    // 1. Drag child1 from the stack bar into the regular tab bar (after parent)
    let buttons = container.querySelectorAll(".tab-stack-tab");
    let child1Button = buttons[1];
    let parentRect = parent.getBoundingClientRect();

    TabStacks._draggedStackTab = child1;
    EventUtils.synthesizeDrop(
      child1Button,
      parent,
      [[{ type: "application/x-moz-tabbrowser-tab", data: child1 }]],
      "move",
      window,
      window,
      {
        clientX: parentRect.right + 5,
        clientY: parentRect.top + parentRect.height / 2,
      }
    );

    await TestUtils.waitForCondition(
      () =>
        !TabStacks.stackId(child1) &&
        container.querySelectorAll(".tab-stack-tab").length == 2,
      "child1 was unstacked and removed from the stack bar"
    );

    Assert.ok(!TabStacks.stackId(child1), "child1 has no stack ID");
    Assert.notEqual(
      getComputedStyle(child1).display,
      "none",
      "child1 is now visible in the regular tab bar"
    );
    Assert.deepEqual(
      TabStacks.stackTabs(parent),
      [parent, child2],
      "Remaining stack tabs are parent and child2"
    );

    // 2. Drag parent from the stack bar into the regular tab bar
    // Since only child2 remains, the whole stack dissolves
    buttons = container.querySelectorAll(".tab-stack-tab");
    let parentButton = buttons[0];
    let child1Rect = child1.getBoundingClientRect();

    TabStacks._draggedStackTab = parent;
    EventUtils.synthesizeDrop(
      parentButton,
      child1,
      [[{ type: "application/x-moz-tabbrowser-tab", data: parent }]],
      "move",
      window,
      window,
      {
        clientX: child1Rect.right + 5,
        clientY: child1Rect.top + child1Rect.height / 2,
      }
    );

    await TestUtils.waitForCondition(
      () => bar.hidden && !TabStacks.stackId(parent) && !TabStacks.stackId(child2),
      "Stack dissolved completely after moving parent tab outside stack"
    );

    Assert.ok(!TabStacks.stackId(parent), "parent is unstacked");
    Assert.ok(!TabStacks.stackId(child2), "child2 is unstacked");
    Assert.ok(bar.hidden, "The stack bar is now hidden");
  } finally {
    TabStacks._isDraggingTab = false;
    TabStacks._mouseDownOnTab = false;
    TabStacks._draggedStackTab = null;
    TabStacks._draggedExternalTab = null;
    if (originalOrientation) {
      gBrowser.tabContainer.setAttribute("orient", originalOrientation);
    } else {
      gBrowser.tabContainer.removeAttribute("orient");
    }
  }

  BrowserTestUtils.removeTab(child2);
  BrowserTestUtils.removeTab(child1);
  BrowserTestUtils.removeTab(parent);
});

add_task(async function test_drag_stack_in_regular_tabbar() {
  let first = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    skipAnimation: true,
  });
  let firstChild = BrowserTestUtils.addTab(gBrowser, "about:config", {
    skipAnimation: true,
  });
  let second = BrowserTestUtils.addTab(gBrowser, "about:robots", {
    skipAnimation: true,
  });
  let secondChild = BrowserTestUtils.addTab(gBrowser, "about:mozilla", {
    skipAnimation: true,
  });
  let regular = BrowserTestUtils.addTab(gBrowser, "about:license", {
    skipAnimation: true,
  });
  let originalOrientation = gBrowser.tabContainer.getAttribute("orient");

  try {
    gBrowser.tabContainer.setAttribute("orient", "horizontal");
    TabStacks.stack(firstChild, first);
    TabStacks.stack(secondChild, second);
    TabStacks._draggedExternalTab = first;

    let rect = second.getBoundingClientRect();
    TabStacks._onTabStripDrop({
      dataTransfer: { dropEffect: "move" },
      target: second,
      clientX: rect.right,
      clientY: rect.top + rect.height / 2,
      preventDefault() {},
      stopPropagation() {},
    });

    Assert.deepEqual(
      [first, firstChild, second, secondChild].sort((a, b) => a._tPos - b._tPos),
      [second, secondChild, first, firstChild],
      "Dragging a stack in the main tab bar moves all of its tabs after the target stack"
    );
    Assert.equal(
      TabStacks.stackId(first),
      TabStacks.stackId(firstChild),
      "The moved tabs remain in their stack"
    );

    TabStacks._draggedExternalTab = regular;
    rect = second.getBoundingClientRect();
    TabStacks._onTabStripDrop({
      dataTransfer: { dropEffect: "move" },
      target: second,
      clientX: rect.right,
      clientY: rect.top + rect.height / 2,
      preventDefault() {},
      stopPropagation() {},
    });

    Assert.deepEqual(
      [first, firstChild, second, secondChild, regular].sort(
        (a, b) => a._tPos - b._tPos
      ),
      [second, secondChild, regular, first, firstChild],
      "A tab dropped beside a stack is placed beside the whole stack"
    );
  } finally {
    TabStacks._draggedExternalTab = null;
    if (originalOrientation) {
      gBrowser.tabContainer.setAttribute("orient", originalOrientation);
    } else {
      gBrowser.tabContainer.removeAttribute("orient");
    }
    BrowserTestUtils.removeTab(regular);
    BrowserTestUtils.removeTab(secondChild);
    BrowserTestUtils.removeTab(second);
    BrowserTestUtils.removeTab(firstChild);
    BrowserTestUtils.removeTab(first);
  }
});
