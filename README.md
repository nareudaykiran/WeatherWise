# 🌦️ WeatherWise

A simple, interactive weather application that allows users to search for locations and view current weather information through a clean, animated user interface.

## ✨ Features

- **Location Search:** Search for countries, states, cities, towns, and other supported locations.
- **Current Weather:** View temperature, feels-like temperature, humidity, and wind speed.
- **Weather Conditions:** See weather descriptions and corresponding icons.
- **Location Details:** Display the selected location and its country information.
- **Animated UI:** Enjoy a responsive interface with weather-themed visual effects.
- **Location Suggestions:** Choose from matching locations returned by the location search service.
- **API Integration:** Fetch location and weather data from external weather services.

## 🛠️ Technologies Used

- **Frontend:** HTML5, CSS3, JavaScript
- **Backend:** Python, FastAPI
- **Templates:** Jinja2
- **HTTP Requests:** HTTPX
- **Weather Data:** Open-Meteo API
- **Location Search:** Open-Meteo Geocoding API and OpenStreetMap Nominatim fallback
- **Version Control:** Git and GitHub

## 📁 Project Structure

```text
WeatherWise/
├── app.py
├── requirements.txt
├── README.md
├── .gitignore
├── templates/
│   └── index.html
└── static/
    ├── style.css
    └── script.js
```

## ⚙️ Requirements

- Python 3.10 or later
- Git
- An internet connection to retrieve weather and location data

## 🚀 Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/nareudaykiran/WeatherWise.git
cd WeatherWise
```

### 2. Create a virtual environment

**Windows PowerShell:**

```powershell
python -m venv .venv
```

### 3. Activate the virtual environment

```powershell
.\.venv\Scripts\Activate.ps1
```

### 4. Install dependencies

```powershell
pip install -r requirements.txt
```

### 5. Run the application

```powershell
python app.py
```

### 6. Open the application

Visit the following URL in your browser:

http://127.0.0.1:5001

To explore the backend API documentation, visit:

http://127.0.0.1:5001/docs

## 🌍 APIs and Data Sources

- [Open-Meteo](https://open-meteo.com/) — Weather forecasts and geocoding.
- [OpenStreetMap Nominatim](https://nominatim.org/) — Fallback location search.

Location availability and weather data depend on the external services, network connectivity, and the coordinates returned by the location search.

**Note:** The public Nominatim service has usage limits and is not intended for unrestricted, high-volume requests.

## ⚠️ Limitations

- Weather information depends on external API availability.
- Some villages or less-populated locations may not be found or may have multiple matching results.
- The application requires an internet connection for live data.
- Weather data should be treated as informational and may not reflect real-time conditions at every location.

## 🎯 Project Objective

WeatherWise is a learning project built to practice frontend development, Python backend development, API integration, location-based search, and Git/GitHub version control.

## 👨‍💻 Author

**Nare Uday Kiran**

GitHub: [@nareudaykiran](https://github.com/nareudaykiran)

---

If you find this project useful, feel free to explore the code and suggest improvements.
