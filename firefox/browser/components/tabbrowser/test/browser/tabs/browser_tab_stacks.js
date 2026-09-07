/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
    child.hasAttribute("stack-parent"),
    "closing the parent promotes the next stack member"
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
      is(
        TabStacks.stackTabs(parent).at(-1),
        relatedTab,
        "A Ctrl-clicked or middle-clicked link is the rightmost stack tab"
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
