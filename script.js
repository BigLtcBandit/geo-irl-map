class IRLMapOverlay {
    constructor() {
        this.map = null;
        this.currentMarker = null;
        this.pathPolyline = null;
        this.pathCoordinates = [];
        this.lastPosition = null;
        this.lastTimestamp = null;
        this.currentSpeed = 0;
        this.currentBearing = 0;
        this.watchId = null;
        this.isFirstLocation = true;
        this.lastLocationUpdate = 0;
        this.currentLocationName = '';
        this.lastWeatherUpdate = 0;
        this.currentWeather = null;
        this.isStationary = false;
        this.stationaryStartTime = null;
        this.displayRotationInterval = null;
        this.showingDateTime = false; 
        this.currentTimezone = null;
        
        // Customization parameters from URL, initialized with defaults
        this.showWeather = true; 
        this.rotateDateTime = true;
        this.speedUnit = 'kmh';
        this.powerSave = false;
        this.dataSaver = false;
        this.mapEnabled = true;
        this.trackingState = 'high';
        
        // Speed calculation settings
        this.speedHistory = [];
        this.speedHistorySize = 5;
        this.minSpeedThreshold = 0.5;
        this.minDistanceThreshold = 5;
        this.accuracyThreshold = 50;
        this.maxReasonableSpeed = 60;
        
        // Location update settings
        this.locationUpdateInterval = this.dataSaver ? 120000 : 60000;
        this.locationUpdateDistance = 1000;
        this.weatherUpdateInterval = this.dataSaver ? 900000 : 600000; // 15 or 10 minutes
        this.stationaryDelay = 3000; // 3 seconds before showing weather
        this.displayRotationTime = 30000; // 30 seconds
        
        this.parseUrlParameters(); // Parse URL parameters first
        this.applyOverlayStyles(); // Apply dynamic styles based on parsed parameters

        // FIX: Immediately set the initial speed unit display based on parsed parameters
        const speedUnitElement = document.getElementById('speed-unit');
        if (speedUnitElement) {
            speedUnitElement.textContent = this.speedUnit === 'mph' ? 'mph' : 'km/h';
        }

        this.initMap();
        this.startTracking();
        this.setupEventListeners();
        
        // Conditional start of display rotation based on parsed parameter
        if (this.rotateDateTime) {
            this.startDisplayRotation();
        } else {
            // If rotation is disabled, ensure location is displayed and doesn't switch
            this.showingDateTime = false; 
            this.updateLocationDisplay(); 
        }
    }

    // Function to parse URL query parameters
    parseUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        
        // Boolean flags
        if (urlParams.has('weather')) {
            this.showWeather = urlParams.get('weather').toLowerCase() === 'true';
        }
        if (urlParams.has('time')) { // 'time' refers to the date/time rotation
            this.rotateDateTime = urlParams.get('time').toLowerCase() === 'true';
        }
        if (urlParams.has('powersave')) {
            this.powerSave = urlParams.get('powersave').toLowerCase() === 'true';
        }
        if (urlParams.has('datasaver')) {
            this.dataSaver = urlParams.get('datasaver').toLowerCase() === 'true';
        }
        if (urlParams.has('map')) {
            this.mapEnabled = urlParams.get('map').toLowerCase() === 'true';
        }
        
        // Speed unit
        if (urlParams.has('unit')) {
            const unit = urlParams.get('unit').toLowerCase();
            if (unit === 'mph') {
                this.speedUnit = 'mph';
            } else {
                this.speedUnit = 'kmh'; // Default or invalid value
            }
        }
    }

    // Function to apply dynamic styles from URL parameters
    applyOverlayStyles() {
        const overlayContainer = document.getElementById('overlay-container');
        if (overlayContainer) {
            const urlParams = new URLSearchParams(window.location.search);

            // Positioning (prioritize top/left if both specified, otherwise respect individual settings)
            if (urlParams.has('top')) {
                overlayContainer.style.top = urlParams.get('top');
                overlayContainer.style.bottom = 'auto'; // Clear conflicting property
            } else if (urlParams.has('bottom')) {
                overlayContainer.style.bottom = urlParams.get('bottom');
                overlayContainer.style.top = 'auto'; // Clear conflicting property
            }

            if (urlParams.has('right')) {
                overlayContainer.style.right = urlParams.get('right');
                overlayContainer.style.left = 'auto'; // Clear conflicting property
            } else if (urlParams.has('left')) {
                overlayContainer.style.left = urlParams.get('left');
                overlayContainer.style.right = 'auto'; // Clear conflicting property
            }

            // Size
            if (urlParams.has('width')) {
                overlayContainer.style.width = urlParams.get('width');
            }
            if (urlParams.has('height')) {
                overlayContainer.style.height = urlParams.get('height');
            }
        }
    }

    initMap() {
        if (!this.mapEnabled) {
            document.getElementById('map').style.display = 'none';
            return;
        }
        this.map = L.map('map', {
            zoomControl: false,
            attributionControl: false,
            dragging: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            keyboard: false,
            tap: false
        }).setView([40.7128, -74.0060], 15);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: ''
        }).addTo(this.map);
    }

    startDisplayRotation() {
        // Only start rotation if rotateDateTime is true
        if (this.rotateDateTime) {
            this.displayRotationInterval = setInterval(() => {
                this.toggleLocationDisplay();
            }, this.displayRotationTime);
        }
    }

    toggleLocationDisplay() {
        // Only toggle if rotation is enabled
        if (!this.rotateDateTime) {
            this.showingDateTime = false; // Force location if rotation is off
            this.updateLocationDisplay();
            return;
        }
        this.showingDateTime = !this.showingDateTime;
        this.updateLocationDisplay();
    }

    updateLocationDisplay() {
        const locationElement = document.getElementById('location-name');
        
        // Show date/time only if rotateDateTime is true and it's the current state
        if (this.showingDateTime && this.rotateDateTime) {
            const dateTimeString = this.getCurrentDateTime();
            locationElement.innerHTML = dateTimeString;
            locationElement.classList.add('datetime-display');
        } else {
            locationElement.innerHTML = this.currentLocationName || 'Getting location...';
            locationElement.classList.remove('datetime-display');
        }
    }

    getCurrentDateTime() {
        const now = new Date();
        const options = {
            timeZone: this.currentTimezone || undefined,
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };
        try {
            const formatter = new Intl.DateTimeFormat('en-US', options);
            const parts = formatter.formatToParts(now);
            const weekday = parts.find(p => p.type === 'weekday')?.value;
            const day = parts.find(p => p.type === 'day')?.value;
            const month = parts.find(p => p.type === 'month')?.value;
            const year = parts.find(p => p.type === 'year')?.value;
            const hour = parts.find(p => p.type === 'hour')?.value;
            const minute = parts.find(p => p.type === 'minute')?.value;
            return `${weekday}, ${month} ${day}, ${year} • ${hour}:${minute}`;
        } catch (error) {
            console.error('DateTime formatting error:', error);
            const dateStr = now.toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            });
            const timeStr = now.toLocaleTimeString([], {
                hour: '2-digit', 
                minute:'2-digit', 
                hour12: false
            });
            return `${dateStr} • ${timeStr}`;
        }
    }

    async getTimezone(latitude, longitude) {
        try {
            const response = await fetch(
                `https://api.bigdatacloud.net/data/timezone-by-location?latitude=${latitude}&longitude=${longitude}&key=bdc_schematic`
            );
            if (response.ok) {
                const data = await response.json();
                if (data && data.ianaTimeZone) {
                    this.currentTimezone = data.ianaTimeZone;
                    console.log('Detected timezone:', this.currentTimezone);
                }
            }
        } catch (error) {
            console.error('Timezone detection failed:', error);
        }
    }

    startTracking(options) {
        if (!navigator.geolocation) {
            console.error('Geolocation is not supported by this browser.');
            this.showError('Geolocation not supported');
            return;
        }

        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
        }

        const defaultOptions = {
            enableHighAccuracy: !this.powerSave,
            timeout: this.powerSave ? 20000 : 10000,
            maximumAge: this.powerSave ? 5000 : 1000
        };

        const finalOptions = { ...defaultOptions, ...options };

        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.updatePosition(position),
            (error) => this.handleError(error),
            finalOptions
        );
    }

    async updatePosition(position) {
        const { latitude, longitude, speed, accuracy } = position.coords;
        const timestamp = position.timestamp;

        document.getElementById('overlay-container').classList.remove('error-state');

        await this.updateLocationName(latitude, longitude, timestamp);

        if (!this.currentTimezone || (this.lastPosition && 
            this.calculateDistance(this.lastPosition.latitude, this.lastPosition.longitude, latitude, longitude) > 50000)) {
            await this.getTimezone(latitude, longitude);
        }

        if (accuracy > this.accuracyThreshold && !this.isFirstLocation) {
            console.log(`Poor accuracy (${accuracy}m), skipping update`);
            return;
        }

        let calculatedSpeed = 0;

        if (this.lastPosition && this.lastTimestamp && !this.isFirstLocation) {
            const distance = this.calculateDistance(
                this.lastPosition.latitude,
                this.lastPosition.longitude,
                latitude,
                longitude
            );

            const timeDiff = timestamp - this.lastTimestamp;
            
            if (timeDiff > 1000) {
                if (distance >= this.minDistanceThreshold) {
                    if (speed !== null && speed >= 0 && speed <= this.maxReasonableSpeed) {
                        calculatedSpeed = speed;
                    } else {
                        calculatedSpeed = this.calculateSpeed(distance, timeDiff);
                        if (calculatedSpeed > this.maxReasonableSpeed) {
                            calculatedSpeed = this.currentSpeed;
                        }
                    }
                } else {
                    if (speed !== null && speed > this.minSpeedThreshold && speed <= this.maxReasonableSpeed) {
                        calculatedSpeed = speed;
                    } else {
                        calculatedSpeed = 0;
                    }
                }
                
                this.lastPosition = { latitude, longitude };
                this.lastTimestamp = timestamp;
            } else {
                calculatedSpeed = this.currentSpeed;
            }
        } else {
            this.lastPosition = { latitude, longitude };
            this.lastTimestamp = timestamp;
            this.isFirstLocation = false;
            calculatedSpeed = 0;
        }

        this.currentSpeed = this.filterSpeed(calculatedSpeed);
        
        if (this.currentSpeed > this.minSpeedThreshold) {
            this.currentBearing = this.calculateBearing(
                this.lastPosition.latitude,
                this.lastPosition.longitude,
                latitude,
                longitude
            );
        }

        await this.handleStationaryState(latitude, longitude, timestamp);
        
        this.updateMap(latitude, longitude);
        this.updateSpeedDisplay();
        this.updateDirectionDisplay();

        if (this.powerSave) {
            constnewState = this.currentSpeed > 2 ? 'high' : 'low';
            if (newState !== this.trackingState) {
                this.trackingState = newState;
                const options = this.trackingState === 'high'
                    ? { enableHighAccuracy: true, maximumAge: 1000 }
                    : { enableHighAccuracy: false, maximumAge: 10000 };
                this.startTracking(options);
            }
        }
    }

    async handleStationaryState(latitude, longitude, timestamp) {
        const speedKmh = Math.max(0, this.currentSpeed * 3.6);
        const isCurrentlyStationary = speedKmh < 1;

        if (isCurrentlyStationary && !this.isStationary) {
            this.stationaryStartTime = timestamp;
            this.isStationary = true;
        } else if (!isCurrentlyStationary && this.isStationary) {
            this.isStationary = false;
            this.stationaryStartTime = null;
        }

        // Only update weather if showWeather is true and conditions are met
        if (this.showWeather && this.isStationary && this.stationaryStartTime && 
            (timestamp - this.stationaryStartTime) > this.stationaryDelay) {
            
            const shouldUpdateWeather = 
                !this.currentWeather || 
                (timestamp - this.lastWeatherUpdate) > this.weatherUpdateInterval;

            if (shouldUpdateWeather) {
                await this.updateWeather(latitude, longitude, timestamp);
            }
        }
    }

    async updateWeather(latitude, longitude, timestamp) {
        if (this.dataSaver) return;
        try {
            const response = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}¤t_weather=true&temperature_unit=celsius`
            );
            
            if (!response.ok) {
                throw new Error('Weather service unavailable');
            }
            
            const data = await response.json();
            
            if (data && data.current_weather) {
                const weather = data.current_weather;
                this.currentWeather = {
                    temperature: Math.round(weather.temperature),
                    weatherCode: weather.weathercode,
                    windSpeed: Math.round(weather.windspeed)
                };
                this.lastWeatherUpdate = timestamp;
                console.log('Weather updated:', this.currentWeather);
            }
        } catch (error) {
            console.error('Weather update failed:', error);
            this.currentWeather = null;
        }
    }

    getWeatherIcon(weatherCode) {
        const weatherIcons = {
            0: '☀️',   // Clear sky
            1: '🌤️',   // Mainly clear
            2: '⛅',   // Partly cloudy
            3: '☁️',   // Overcast
            45: '🌫️',  // Fog
            48: '🌫️',  // Depositing rime fog
            51: '🌦️',  // Light drizzle
            53: '🌦️',  // Moderate drizzle
            55: '🌦️',  // Dense drizzle
            61: '🌧️',  // Slight rain
            63: '🌧️',  // Moderate rain
            65: '🌧️',  // Heavy rain
            71: '🌨️',  // Slight snow
            73: '🌨️',  // Moderate snow
            75: '🌨️',  // Heavy snow
            77: '❄️',  // Snow grains
            80: '🌦️',  // Slight rain showers
            81: '🌧️',  // Moderate rain showers
            82: '🌧️',  // Violent rain showers
            85: '🌨️',  // Slight snow showers
            86: '🌨️',  // Heavy snow showers
            95: '⛈️',  // Thunderstorm
            96: '⛈️',  // Thunderstorm with hail
            99: '⛈️'   // Thunderstorm with heavy hail
        };
        return weatherIcons[weatherCode] || '🌡️';
    }

    async updateLocationName(latitude, longitude, timestamp) {
        if (this.dataSaver) {
            this.currentLocationName = 'Data Saver Mode';
            this.updateLocationDisplay();
            return;
        }
        const shouldUpdate = 
            !this.currentLocationName || 
            (timestamp - this.lastLocationUpdate) > this.locationUpdateInterval ||
            (this.lastPosition && this.calculateDistance(
                this.lastPosition.latitude, 
                this.lastPosition.longitude, 
                latitude, 
                longitude
            ) > this.locationUpdateDistance);

        if (shouldUpdate) {
            try {
                const locationName = await this.reverseGeocode(latitude, longitude);
                this.currentLocationName = locationName;
                this.lastLocationUpdate = timestamp;
                
                // Update display only if currently showing location (not datetime or if datetime rotation is off)
                if (!this.showingDateTime || !this.rotateDateTime) {
                    this.updateLocationDisplay();
                }
            } catch (error) {
                console.error('Reverse geocoding failed:', error);
                this.currentLocationName = 'Location unavailable';
                if (!this.showingDateTime || !this.rotateDateTime) {
                    this.updateLocationDisplay();
                }
            }
        }
    }

    async reverseGeocode(latitude, longitude) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`,
                {
                    headers: {
                        'User-Agent': 'IRL-Stream-Overlay/1.0'
                    }
                }
            );
            
            if (!response.ok) {
                throw new Error('Geocoding service unavailable');
            }
            
            const data = await response.json();
            
            if (data && data.address) {
                const address = data.address;
                let locationParts = [];
                
                if (address.city) {
                    locationParts.push(address.city);
                } else if (address.town) {
                    locationParts.push(address.town);
                } else if (address.village) {
                    locationParts.push(address.village);
                } else if (address.suburb) {
                    locationParts.push(address.suburb);
                } else if (address.county) {
                    locationParts.push(address.county);
                }
                
                if (address.state) {
                    locationParts.push(address.state);
                } else if (address.region) {
                    locationParts.push(address.region);
                }
                
                if (address.country) {
                    locationParts.push(address.country);
                }
                
                return locationParts.length > 0 ? locationParts.join(', ') : 'Unknown Location';
            }
            
            return 'Unknown Location';
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            return 'Location unavailable';
        }
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    calculateSpeed(distance, timeDiff) {
        const timeInSeconds = timeDiff / 1000;
        return distance / timeInSeconds;
    }

    filterSpeed(rawSpeed) {
        if (rawSpeed < this.minSpeedThreshold) {
            rawSpeed = 0;
        }

        this.speedHistory.push(rawSpeed);
        
        if (this.speedHistory.length > this.speedHistorySize) {
            this.speedHistory.shift();
        }

        if (this.speedHistory.length < 3) {
            return rawSpeed;
        }

        let weightedSum = 0;
        let totalWeight = 0;
        
        for (let i = 0; i < this.speedHistory.length; i++) {
            const weight = i + 1;
            weightedSum += this.speedHistory[i] * weight;
            totalWeight += weight;
        }
        
        const averageSpeed = weightedSum / totalWeight;

        const recentLowSpeeds = this.speedHistory.slice(-3).filter(s => s < this.minSpeedThreshold).length;
        if (recentLowSpeeds >= 2 && averageSpeed < this.minSpeedThreshold * 2) {
            return 0;
        }

        return averageSpeed;
    }

    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    calculateBearing(lat1, lon1, lat2, lon2) {
        const y = Math.sin(this.toRadians(lon2 - lon1)) * Math.cos(this.toRadians(lat2));
        const x = Math.cos(this.toRadians(lat1)) * Math.sin(this.toRadians(lat2)) -
                  Math.sin(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * Math.cos(this.toRadians(lon2 - lon1));
        const bearing = (this.toRadians(360) + Math.atan2(y, x)) % this.toRadians(360);
        return (bearing * 180) / Math.PI;
    }

    bearingToCardinal(bearing) {
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const index = Math.round(bearing / 45) % 8;
        return directions[index];
    }

    updateDirectionDisplay() {
        const directionDisplay = document.getElementById('direction-display');
        if (this.currentSpeed > this.minSpeedThreshold) {
            directionDisplay.classList.add('visible');
            const directionArrow = document.getElementById('direction-arrow');
            const directionAbbr = document.getElementById('direction-abbr');

            directionArrow.style.transform = `rotate(${this.currentBearing}deg)`;
            directionAbbr.textContent = this.bearingToCardinal(this.currentBearing);
        } else {
            directionDisplay.classList.remove('visible');
        }
    }

    updateSpeedDisplay() {
        let displaySpeed;
        let unitText;
        let speedMultiplier;

        if (this.speedUnit === 'mph') {
            speedMultiplier = 2.23694; // meters/second to mph
            unitText = 'mph';
        } else { // kmh
            speedMultiplier = 3.6; // meters/second to km/h
            unitText = 'km/h';
        }

        const speed = Math.max(0, this.currentSpeed * speedMultiplier);
        displaySpeed = speed < 1 ? 0 : speed; // Set to 0 if very slow

        const speedElement = document.getElementById('speed-value');
        const speedUnit = document.getElementById('speed-unit');
        
        // Check if we should show weather instead of speed (only if showWeather is enabled)
        const shouldShowWeather = this.showWeather && displaySpeed === 0 && this.isStationary && 
                                 this.stationaryStartTime && 
                                 (Date.now() - this.stationaryStartTime) > this.stationaryDelay &&
                                 this.currentWeather;

        if (shouldShowWeather) {
            // Show weather
            const weatherIcon = this.getWeatherIcon(this.currentWeather.weatherCode);
            speedElement.innerHTML = `${weatherIcon}<br><span style="font-size: 18px;">${this.currentWeather.temperature}°</span>`;
            speedUnit.textContent = 'Weather';
            speedElement.className = 'speed-value weather-display';
        } else {
            // Show speed
            speedElement.textContent = displaySpeed.toFixed(1);
            speedUnit.textContent = unitText; // Use dynamic unit
            
            const lastSpeed = parseFloat(speedElement.dataset.lastSpeed || 0);
            if (Math.abs(displaySpeed - lastSpeed) > (this.speedUnit === 'mph' ? 1.5 : 2)) { // Adjust threshold for mph
                speedElement.classList.add('speed-update');
                setTimeout(() => speedElement.classList.remove('speed-update'), 200);
            }
            speedElement.dataset.lastSpeed = displaySpeed;
            
            // Kick.com style color coding (thresholds adjusted for mph)
            speedElement.className = 'speed-value';
            if (displaySpeed === 0) {
                speedElement.classList.add('speed-stationary');
            } else if (displaySpeed < (this.speedUnit === 'mph' ? 6 : 10)) { 
                speedElement.classList.add('speed-slow');
            } else if (displaySpeed < (this.speedUnit === 'mph' ? 18 : 30)) {
                speedElement.classList.add('speed-medium');
            } else if (displaySpeed < (this.speedUnit === 'mph' ? 37 : 60)) {
                speedElement.classList.add('speed-fast');
            } else {
                speedElement.classList.add('speed-very-fast');
            }
        }
    }

    updateMap(latitude, longitude) {
        if (!this.mapEnabled) return;
        const currentLatLng = [latitude, longitude];
        
        if (this.currentMarker) {
            this.currentMarker.setLatLng(currentLatLng);
        } else {
            const customIcon = L.divIcon({
                className: 'pulse-marker',
                html: '<div style="background: linear-gradient(135deg, #53fc18 0%, #00ff88 100%); width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(83, 252, 24, 0.5);"></div>',
                iconSize: [18, 18],
                iconAnchor: [9, 9]
            });
            
            this.currentMarker = L.marker(currentLatLng, { icon: customIcon }).addTo(this.map);
        }

        if (this.isFirstLocation) {
            this.map.setView(currentLatLng, 15);
            this.isFirstLocation = false;
        } else {
            this.map.panTo(currentLatLng);
        }

        if (this.currentSpeed > this.minSpeedThreshold) {
            this.pathCoordinates.push(currentLatLng);
            
            if (this.pathCoordinates.length > 100) {
                this.pathCoordinates.shift();
            }

            if (this.pathPolyline) {
                this.pathPolyline.setLatLngs(this.pathCoordinates);
            } else {
                this.pathPolyline = L.polyline(this.pathCoordinates, {
                    color: '#53fc18',
                    weight: 3,
                    opacity: 0.8
                }).addTo(this.map);
            }
        }
    }

    handleError(error) {
        console.error('Geolocation error:', error);
        
        document.getElementById('overlay-container').classList.add('error-state');
        
        let errorMsg = 'Location Error';
        switch(error.code) {
            case error.PERMISSION_DENIED:
                errorMsg = 'Location Permission Denied';
                break;
            case error.POSITION_UNAVAILABLE:
                errorMsg = 'Location Unavailable';
                break;
            case error.TIMEOUT:
                errorMsg = 'Location Timeout';
                break;
        }
        
        this.currentLocationName = errorMsg;
        this.updateLocationDisplay();
    }

    showError(message) {
        document.getElementById('overlay-container').classList.add('error-state');
        this.currentLocationName = message;
        this.updateLocationDisplay();
    }

    setupEventListeners() {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.isFirstLocation = true;
            }
        });

        window.addEventListener('resize', () => {
            if (this.map) {
                this.map.invalidateSize();
            }
        });
    }

    recenter() {
        if (this.lastPosition) {
            this.map.setView([this.lastPosition.latitude, this.lastPosition.longitude], 15);
        }
    }

    destroy() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
        }
        if (this.displayRotationInterval) {
            clearInterval(this.displayRotationInterval);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const overlay = new IRLMapOverlay();
    window.irlOverlay = overlay;
    window.recenterMap = () => {
        if (window.irlOverlay) {
            window.irlOverlay.recenter();
        }
    };
});

window.addEventListener('beforeunload', () => {
    if (window.irlOverlay) {
        window.irlOverlay.destroy();
    }
});
