/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

add_task(async function test_stack_restores_active_tab() {
  let root = BrowserTestUtils.addTab(gBrowser, "data:,stack-root");
  let child = BrowserTestUtils.addTab(gBrowser, "data:,stack-child");
  let other = BrowserTestUtils.addTab(gBrowser, "data:,other-tab");

  registerCleanupFunction(async () => {
    for (let tab of [child, root, other]) {
      if (!tab.closing && tab.isConnected) {
        await BrowserTestUtils.removeTab(tab);
      }
    }
  });

  TabStacks.stack(child, root);
  await BrowserTestUtils.switchTab(gBrowser, child);
  await BrowserTestUtils.switchTab(gBrowser, other);

  let restored = BrowserTestUtils.waitForEvent(
    gBrowser.tabContainer,
    "TabSelect",
    false,
    event => event.target == child
  );
  gBrowser.selectedTab = root;
  await restored;

  is(gBrowser.selectedTab, child, "Selecting a stack restores its active tab");

  TabStacks.toggle(root);
  is(gBrowser.selectedTab, root, "Collapsing a stack still selects its root");
});
