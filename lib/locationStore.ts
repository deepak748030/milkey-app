import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

interface LocationState {
    locationName: string;
    fetched: boolean;
}

let cachedLocation: LocationState = {
    locationName: 'Fetching...',
    fetched: false,
};

let listeners: ((state: LocationState) => void)[] = [];

export const getLocationState = () => cachedLocation;

export const subscribeToLocation = (listener: (state: LocationState) => void) => {
    listeners.push(listener);
    return () => {
        listeners = listeners.filter(l => l !== listener);
    };
};

const notifyListeners = () => {
    listeners.forEach(listener => listener(cachedLocation));
};

export const fetchLocationOnce = async (): Promise<string> => {
    // If already fetched, return cached value
    if (cachedLocation.fetched) {
        return cachedLocation.locationName;
    }

    try {
        // Check if we have a cached location in AsyncStorage
        const stored = await AsyncStorage.getItem('userLocation');
        if (stored) {
            cachedLocation = { locationName: stored, fetched: true };
            notifyListeners();
            return stored;
        }

        // Request permission and fetch location
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            cachedLocation = { locationName: 'Permission denied', fetched: true };
            notifyListeners();
            return cachedLocation.locationName;
        }

        const location = await Location.getCurrentPositionAsync({});
        const geocode = await Location.reverseGeocodeAsync({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
        });

        if (geocode && geocode.length > 0) {
            const city = geocode[0].city || geocode[0].subregion || 'Unknown';
            cachedLocation = { locationName: city, fetched: true };
            await AsyncStorage.setItem('userLocation', city);
        } else {
            cachedLocation = { locationName: 'Location unknown', fetched: true };
        }
    } catch (error) {
        console.error('Error fetching location:', error);
        cachedLocation = { locationName: 'Error fetching', fetched: true };
    }

    notifyListeners();
    return cachedLocation.locationName;
};

export const resetLocationCache = async () => {
    cachedLocation = { locationName: 'Fetching...', fetched: false };
    await AsyncStorage.removeItem('userLocation');
    notifyListeners();
};
