/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

add_task(async function test_stack_restores_active_tab() {
  let root = BrowserTestUtils.addTab(gBrowser, "data:,stack-root");
  let child = BrowserTestUtils.addTab(gBrowser, "data:,stack-child");
  let grandchild = BrowserTestUtils.addTab(gBrowser, "data:,stack-grandchild");
  let other = BrowserTestUtils.addTab(gBrowser, "data:,other-tab");

  registerCleanupFunction(async () => {
    for (let tab of [grandchild, child, root, other]) {
      if (!tab.closing && tab.isConnected) {
        await BrowserTestUtils.removeTab(tab);
      }
    }
  });

  TabStacks.stack(child, root);
  TabStacks.stack(grandchild, child);
  await BrowserTestUtils.switchTab(gBrowser, grandchild);
  await BrowserTestUtils.switchTab(gBrowser, other);

  let restored = BrowserTestUtils.waitForEvent(
    gBrowser.tabContainer,
    "TabSelect",
    false,
    event => event.target == grandchild
  );
  gBrowser.selectedTab = root;
  await restored;

  is(
    gBrowser.selectedTab,
    grandchild,
    "Selecting a stack restores its last active nested tab"
  );

  TabStacks.toggle(root);
  is(gBrowser.selectedTab, root, "Collapsing a stack still selects its root");
});
