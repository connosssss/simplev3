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
