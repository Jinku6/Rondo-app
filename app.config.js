const appJson = require("./app.json");
const fs = require("fs");

const config = appJson.expo;
const androidGoogleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
const androidGoogleServicesFile = process.env.GOOGLE_SERVICES_JSON_PATH ?? "./google-services.json";

config.extra = {
  ...config.extra,
  androidGoogleMapsConfigured: !!androidGoogleMapsApiKey,
};

if (androidGoogleMapsApiKey) {
  config.android = {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: {
        ...config.android?.config?.googleMaps,
        apiKey: androidGoogleMapsApiKey,
      },
    },
  };
}

if (fs.existsSync(androidGoogleServicesFile)) {
  config.android = {
    ...config.android,
    googleServicesFile: androidGoogleServicesFile,
  };
}

module.exports = config;
