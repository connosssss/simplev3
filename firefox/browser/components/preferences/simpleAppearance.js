
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
    const opacityPref = Preferences.get(
      "simple.theme.transparent-toolbar.opacity"
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

    const updateOpacityUI = (val) => {
      let opacity = val;
      if (opacity === undefined || opacity === null) {
        opacity = parseInt(transparentToolbarOpacitySlider.value, 10);
      }
      if (isNaN(opacity)) {
        opacity = Services.prefs.getIntPref(
          "simple.theme.transparent-toolbar.opacity",
          55
        );
      }
      transparentToolbarOpacitySlider.value = opacity;
      transparentToolbarOpacityLabel.textContent = opacity + "%";
    };

    const updateTransparentToolbarUI = () => {
      transparentToolbarOpacityBox.hidden = !transparentToolbarPref.value;
      updateOpacityUI();
    };

    let initialOpacity = opacityPref?.value;
    if (initialOpacity === undefined || initialOpacity === null) {
      initialOpacity = Services.prefs.getIntPref(
        "simple.theme.transparent-toolbar.opacity",
        55
      );
    }
    updateOpacityUI(initialOpacity);
    updateTransparentToolbarUI();

    transparentToolbarPref.on("change", updateTransparentToolbarUI);

    if (opacityPref) {
      opacityPref.on("change", () => {
        updateOpacityUI(opacityPref.value);
      });
    }

    const onSliderInput = () => {
      const val = parseInt(transparentToolbarOpacitySlider.value, 10);
      transparentToolbarOpacityLabel.textContent = val + "%";
      if (opacityPref) {
        opacityPref.value = val;
      }
      Services.prefs.setIntPref("simple.theme.transparent-toolbar.opacity", val);
    };

    transparentToolbarOpacitySlider.addEventListener("input", onSliderInput);
    transparentToolbarOpacitySlider.addEventListener("change", onSliderInput);

    const prefObserver = {
      observe(subject, topic, data) {
        if (data === "simple.theme.transparent-toolbar.opacity") {
          const val = Services.prefs.getIntPref(data, 55);
          updateOpacityUI(val);
        }
      },
    };
    Services.prefs.addObserver(
      "simple.theme.transparent-toolbar.opacity",
      prefObserver
    );
    window.addEventListener(
      "unload",
      () => {
        Services.prefs.removeObserver(
          "simple.theme.transparent-toolbar.opacity",
          prefObserver
        );
      },
      { once: true }
    );
  },
};
