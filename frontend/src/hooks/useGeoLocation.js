import { useState, useEffect, useRef, useCallback } from "react";

export function useGeoLocation(options = {}) {
  const { enabled = false, onPosition, highAccuracy = true } = options;
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [watching, setWatching] = useState(false);
  const watchIdRef = useRef(null);
  const callbackRef = useRef(onPosition);
  callbackRef.current = onPosition;

  useEffect(() => {
    callbackRef.current = onPosition;
  }, [onPosition]);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocalización no disponible");
      return;
    }

    if (watchIdRef.current !== null) return;

    setWatching(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const data = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speed: pos.coords.speed || 0,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        };
        setLocation(data);
        setError(null);
        callbackRef.current?.(data);
      },
      (err) => {
        setError(`Error GPS: ${err.message}`);
        setWatching(false);
      },
      {
        enableHighAccuracy: highAccuracy,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [highAccuracy]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setWatching(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      startWatching();
    } else {
      stopWatching();
    }
    return stopWatching;
  }, [enabled, startWatching, stopWatching]);

  return { location, error, watching, startWatching, stopWatching };
}
