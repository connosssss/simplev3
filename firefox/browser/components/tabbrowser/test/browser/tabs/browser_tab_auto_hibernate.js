/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

add_task(async function test_auto_hibernate_context_menu() {
  let tab = await addTab();
  let menu = await openTabContextMenu(tab);

  let neverAutoHibernateItem = document.getElementById(
    "context_neverAutoHibernate"
  );
  let allowAutoHibernateItem = document.getElementById(
    "context_allowAutoHibernate"
  );

  ok(!neverAutoHibernateItem.hidden, "Never Auto-Hibernate is visible");
  ok(allowAutoHibernateItem.hidden, "Allow Auto-Hibernation is hidden");

  let protected = BrowserTestUtils.waitForEvent(
    tab,
    "TabAttrModified",
    false,
    event => event.detail.changed.includes("undiscardable")
  );
  let menuHidden = BrowserTestUtils.waitForPopupEvent(menu, "hidden");
  menu.activateItem(neverAutoHibernateItem);
  await menuHidden;
  await protected;
  ok(tab.undiscardable, "tab is protected from automatic hibernation");

  menu = await openTabContextMenu(tab);
  ok(neverAutoHibernateItem.hidden, "Never Auto-Hibernate is hidden");
  ok(!allowAutoHibernateItem.hidden, "Allow Auto-Hibernation is visible");

  let unprotected = BrowserTestUtils.waitForEvent(
    tab,
    "TabAttrModified",
    false,
    event => event.detail.changed.includes("undiscardable")
  );
  menuHidden = BrowserTestUtils.waitForPopupEvent(menu, "hidden");
  menu.activateItem(allowAutoHibernateItem);
  await menuHidden;
  await unprotected;
  ok(!tab.undiscardable, "tab can be automatically hibernated again");

  BrowserTestUtils.removeTab(tab);
});
