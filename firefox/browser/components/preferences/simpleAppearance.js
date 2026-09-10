
"use strict";

var gSimpleAppearancePane = {
  init() {
    Preferences.addAll([
      { id: "simple.theme.transparent-toolbar", type: "bool" },
      { id: "simple.theme.transparent-toolbar.opacity", type: "int" },
    ]);

    const transparentToolbarPref = Preferences.get(
      "simple.theme.transparent-toolbar"
    );
    const transparentToolbarOpacityBox = document.getElementById(
      "transparentToolbarOpacityBox"
    );
    const transparentToolbarOpacitySlider = document.getElementById(
      "transparentToolbarOpacity"
    );
    const transparentToolbarOpacityLabel = document.getElementById(
      "transparentToolbarOpacityLabel"
    );

    const updateTransparentToolbarUI = () => {
      transparentToolbarOpacityBox.hidden = !transparentToolbarPref.value;
      transparentToolbarOpacityLabel.textContent =
        transparentToolbarOpacitySlider.value + "%";
    };

    transparentToolbarPref.on("change", updateTransparentToolbarUI);
    transparentToolbarOpacitySlider.addEventListener(
      "input",
      updateTransparentToolbarUI
    );
    updateTransparentToolbarUI();
  },
};
