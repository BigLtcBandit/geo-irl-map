# IRL Stream Overlay

A customizable, real-time map and data overlay for live streaming, designed to work with the [IRL Pro](https://play.google.com/store/apps/details?id=com.irlpro.irlpro) streaming app for Android. This overlay displays your current location on a map, your speed, and your direction of travel.

## Features

-   **Live Map**: Shows your current location and path on a map.
-   **Speedometer**: Displays your current speed in km/h or mph.
-   **Direction Display**: Shows your direction of travel with a cardinal abbreviation (e.g., N, NE).
-   **Location Name**: Shows your current city, state, and country.
-   **Weather Display**: When you are stationary, the overlay can show the current weather conditions.
-   **Customizable**: You can customize the overlay's appearance and features using URL parameters.

## Hosted Version

You can use the hosted version of this overlay at:
**https://kickis.fun**

## Usage

To use this overlay in your streaming software (like OBS, Streamlabs, or directly in IRL Pro), add a new "Browser Source" and use the URL of the hosted version. You can customize the overlay by adding URL parameters to the end of the URL.

For example: `https://kickis.fun?weather=false&time=false&unit=mph`

### Customization Parameters

-   `time`: Set to `false` to disable the rotation between location name and date/time. (Default: `true`)
-   `unit`: Set to `mph` to display speed in miles per hour. (Default: `kmh`)
-   `powersave`: Set to `true` to reduce battery consumption by lowering GPS accuracy and update frequency. (Default: `false`)
-   `datasaver`: Set to `true` to reduce data usage by disabling location name and weather lookups. (Default: `false`)

## Credits

This overlay was created by the user and modified by Jules. The map is powered by [Leaflet](httpss://leafletjs.com/) and [OpenStreetMap](https://www.openstreetmap.org/). Weather data is from [Open-Meteo](https://open-meteo.com/).

## License

This project is open source and available for anyone to use, modify, and distribute. You are free to use it in your personal and commercial projects.
