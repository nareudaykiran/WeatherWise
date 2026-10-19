
const form = document.getElementById("weather-form");
const cityInput = document.getElementById("city-input");
const searchButton = document.getElementById("search-button");
const message = document.getElementById("message");
const weatherCard = document.getElementById("weather-card");

const cityName = document.getElementById("city-name");
const countryName = document.getElementById("country-name");
const weatherIcon = document.getElementById("weather-icon");
const weatherDescription = document.getElementById("weather-description");
const temperature = document.getElementById("temperature");
const feelsLike = document.getElementById("feels-like");
const humidity = document.getElementById("humidity");
const windSpeed = document.getElementById("wind-speed");
const weatherScene = document.getElementById("weather-scene");

let currentLocations = [];
let isSearching = false;

// Create the location-results area without changing your HTML.
const locationResults = document.createElement("div");
locationResults.id = "location-results";
locationResults.style.cssText = `
    display: none;
    margin-top: 12px;
    padding: 8px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.96);
    color: #202938;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    text-align: left;
`;

if (form) {
    form.insertAdjacentElement("afterend", locationResults);
}

// Add simple styling for selectable locations.
const locationStyle = document.createElement("style");
locationStyle.textContent = `
    #location-results .location-option {
        display: block;
        width: 100%;
        margin: 4px 0;
        padding: 12px;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        background: white;
        color: #202938;
        text-align: left;
        cursor: pointer;
        font: inherit;
        transition: background 0.2s, border-color 0.2s;
    }

    #location-results .location-option:hover,
    #location-results .location-option:focus {
        background: #eef6ff;
        border-color: #60a5fa;
        outline: none;
    }

    #location-results .location-option strong {
        display: block;
        margin-bottom: 4px;
    }

    #location-results .location-option small {
        display: block;
        color: #64748b;
        line-height: 1.5;
    }

    #location-results .results-heading {
        padding: 8px 10px;
        font-weight: 600;
    }
`;
document.head.appendChild(locationStyle);


// WMO weather-code descriptions.
function describeWeather(code) {
    if (code === 0) return { description: "Clear sky", icon: "☀️", theme: "sunny" };
    if (code === 1) return { description: "Mainly clear", icon: "🌤️", theme: "sunny" };
    if (code === 2) return { description: "Partly cloudy", icon: "⛅", theme: "cloudy" };
    if (code === 3) return { description: "Overcast", icon: "☁️", theme: "cloudy" };
    if ([45, 48].includes(code)) return { description: "Foggy", icon: "🌫️", theme: "fog" };

    if ([51, 53, 55, 56, 57].includes(code)) {
        return { description: "Drizzle", icon: "🌦️", theme: "drizzle" };
    }

    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
        return { description: "Rain", icon: "🌧️", theme: "rain" };
    }

    if ([71, 73, 75, 77, 85, 86].includes(code)) {
        return { description: "Snow", icon: "❄️", theme: "snow" };
    }

    if ([95, 96, 99].includes(code)) {
        return { description: "Thunderstorm", icon: "⛈️", theme: "thunder" };
    }

    return { description: "Weather information available", icon: "🌍", theme: "cloudy" };
}


function setWeatherTheme(theme) {
    const themes = [
        "sunny", "night", "cloudy", "fog",
        "drizzle", "rain", "snow", "thunder"
    ];

    document.body.classList.remove(
        ...themes.map(name => `weather-${name}`)
    );

    document.body.classList.add(`weather-${theme}`);

    if (weatherScene) {
        weatherScene.className = "weather-scene";
        weatherScene.classList.add(`weather-${theme}`);
    }
}


function showMessage(text, isError = false) {
    if (!message) return;

    message.textContent = text;
    message.style.display = "block";
    message.style.color = isError ? "#dc2626" : "";
}


function clearMessage() {
    if (message) {
        message.textContent = "";
        message.style.display = "none";
    }
}


function hideLocations() {
    locationResults.style.display = "none";
    locationResults.replaceChildren();
    currentLocations = [];
}


function setLoading(isLoading, text = "Please wait...") {
    if (searchButton) {
        searchButton.disabled = isLoading;
        searchButton.textContent = isLoading ? text : "Search";
    }

    if (cityInput) {
        cityInput.disabled = isLoading;
    }
}


async function readJson(response) {
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || "Something went wrong. Please try again.");
    }

    return data;
}


// Search for matching cities, villages, towns and other locations.
async function searchLocations(query) {
    hideLocations();
    clearMessage();

    if (!query || query.trim().length < 2) {
        showMessage("Please enter at least two characters.", true);
        return;
    }

    setLoading(true, "Searching...");

    try {
        const response = await fetch(
            `/api/locations?query=${encodeURIComponent(query.trim())}`
        );

        const data = await readJson(response);
        currentLocations = data.results || [];

        if (currentLocations.length === 0) {
            showMessage(
                "No matching places were found. Try adding the district, state or country.",
                true
            );
            return;
        }

        const heading = document.createElement("div");
        heading.className = "results-heading";
        heading.textContent = `Choose a location (${currentLocations.length} found)`;
        locationResults.appendChild(heading);

        currentLocations.forEach((place, index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "location-option";

            const title = document.createElement("strong");
            title.textContent = place.name || "Unknown location";

            const details = document.createElement("small");
            details.textContent =
                place.display_name ||
                [place.admin2, place.admin1, place.country]
                    .filter(Boolean)
                    .join(", ");

            button.append(title, details);

            button.addEventListener("click", () => {
                selectLocation(index);
            });

            locationResults.appendChild(button);
        });

        locationResults.style.display = "block";

        showMessage("Select the correct location to view its weather.");
    } catch (error) {
        showMessage(
            error.message || "Unable to search locations. Check your connection.",
            true
        );
    } finally {
        setLoading(false);
    }
}


// Fetch weather for the selected coordinates, not a guessed place name.
async function selectLocation(index) {
    const place = currentLocations[index];

    if (!place) return;

    hideLocations();
    clearMessage();
    setLoading(true, "Loading weather...");

    try {
        const params = new URLSearchParams({
            latitude: String(place.latitude),
            longitude: String(place.longitude),
            city: place.name || place.display_name || "Selected location"
        });

        const response = await fetch(`/api/weather?${params.toString()}`);
        const data = await readJson(response);

        displayWeather(data, place);
    } catch (error) {
        showMessage(
            error.message || "Unable to fetch weather. Please try again.",
            true
        );
    } finally {
        setLoading(false);
    }
}


// Display current weather in your existing weather card.
function displayWeather(data, place) {
    const current = data.current;
    const units = data.units || {};

    if (!current) {
        showMessage("Weather data is missing from the server response.", true);
        return;
    }

    const weather = describeWeather(current.weather_code);

    if (cityName) {
        cityName.textContent = place.name || data.city || "Selected location";
    }

    if (countryName) {
        countryName.textContent =
            place.display_name ||
            [place.admin2, place.admin1, place.country]
                .filter(Boolean)
                .join(", ");
    }

    if (weatherIcon) {
        weatherIcon.textContent = weather.icon;
    }

    if (weatherDescription) {
        weatherDescription.textContent = weather.description;
    }

    if (temperature) {
        temperature.textContent =
            `${current.temperature_2m ?? "--"}${units.temperature_2m || "°C"}`;
    }

    if (feelsLike) {
        feelsLike.textContent =
            `${current.apparent_temperature ?? "--"}${units.apparent_temperature || "°C"}`;
    }

    if (humidity) {
        humidity.textContent =
            `${current.relative_humidity_2m ?? "--"}${units.relative_humidity_2m || "%"}`;
    }

    if (windSpeed) {
        windSpeed.textContent =
            `${current.wind_speed_10m ?? "--"} ${units.wind_speed_10m || "km/h"}`;
    }

    if (weatherCard) {
        weatherCard.style.display = "block";
        weatherCard.hidden = false;
    }

    setWeatherTheme(weather.theme);
    clearMessage();

    // Move the weather card into view on smaller screens.
    weatherCard?.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}


// Submit the search form.
if (form) {
    form.addEventListener("submit", event => {
        event.preventDefault();

        if (isSearching) return;

        isSearching = true;

        searchLocations(cityInput?.value || "")
            .finally(() => {
                isSearching = false;
            });
    });
}


// Hide suggestions when the user starts entering a new search.
if (cityInput) {
    cityInput.addEventListener("input", () => {
        hideLocations();
        clearMessage();
    });
}


// Prevent Enter or button clicks from causing a full page reload.
if (form) {
    form.setAttribute("autocomplete", "off");
}

console.log("WeatherWise location search is ready.");
