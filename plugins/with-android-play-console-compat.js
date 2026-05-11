const {
  AndroidConfig,
  withAndroidManifest,
  withAndroidStyles,
  withGradleProperties,
} = require("@expo/config-plugins");

const { Styles } = AndroidConfig;

const BAR_STYLE_ITEMS = [
  "android:navigationBarColor",
  "android:navigationBarDividerColor",
  "android:statusBarColor",
];

const RESTRICTED_ACTIVITY_ATTRIBUTES = [
  "android:maxAspectRatio",
  "android:minAspectRatio",
  "android:resizeableActivity",
  "android:screenOrientation",
];

const RESTRICTED_APPLICATION_ATTRIBUTES = [
  "android:maxAspectRatio",
  "android:minAspectRatio",
  "android:resizeableActivity",
];

function removeAttributes(attributes, names) {
  if (!attributes) {
    return;
  }

  for (const name of names) {
    delete attributes[name];
  }
}

function withAndroidPlayConsoleCompat(config) {
  config = withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    removeAttributes(application?.$, RESTRICTED_APPLICATION_ATTRIBUTES);

    for (const activity of application?.activity ?? []) {
      removeAttributes(activity.$, RESTRICTED_ACTIVITY_ATTRIBUTES);
    }

    return config;
  });

  config = withAndroidStyles(config, (config) => {
    for (const name of BAR_STYLE_ITEMS) {
      config.modResults = Styles.removeStylesItem({
        name,
        xml: config.modResults,
        parent: Styles.getAppThemeGroup(),
      });
    }

    return config;
  });

  return withGradleProperties(config, (config) => {
    config.modResults = config.modResults.filter((item) => {
      if (item.type === "property") {
        return item.key !== "expo.edgeToEdgeEnabled";
      }

      if (item.type === "comment") {
        return (
          !item.value.includes("configured to use edge-to-edge via the app config or plugin") &&
          !item.value.includes("deprecated and will be removed in Expo SDK 55")
        );
      }

      return true;
    });

    return config;
  });
}

module.exports = withAndroidPlayConsoleCompat;
