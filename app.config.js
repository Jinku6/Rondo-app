const appJson = require("./app.json");

const config = appJson.expo;
const androidGoogleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

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

module.exports = config;
