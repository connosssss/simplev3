"use strict";

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
  },
};
