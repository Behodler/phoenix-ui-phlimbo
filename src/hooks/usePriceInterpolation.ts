import { useState, useEffect, useRef, useCallback } from 'react';

const STORAGE_KEY = 'phoenix-phusd-price-interpolation';
const TICK_INTERVAL_MS = 500;

interface StoredPriceData {
  price: number;
  timestamp: number;
  delta: number;
}

function readStorage(): StoredPriceData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed.price === 'number' &&
      typeof parsed.timestamp === 'number' &&
      typeof parsed.delta === 'number'
    ) {
      return parsed as StoredPriceData;
    }
    return null;
  } catch {
    return null;
  }
}

function writeStorage(data: StoredPriceData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable (private browsing, quota exceeded)
  }
}

export function usePriceInterpolation(truePrice: number | null): {
  displayPrice: number | null;
} {
  const [displayPrice, setDisplayPrice] = useState<number | null>(() => {
    const stored = readStorage();
    return stored ? stored.price : null;
  });

  const deltaRef = useRef(0);
  const lastTruePriceRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initializedFromStorageRef = useRef(false);
  const hasTruePrice = useRef(false);

  const startTicking = useCallback(() => {
    if (intervalRef.current !== null) return;
    intervalRef.current = setInterval(() => {
      if (deltaRef.current > 0) {
        setDisplayPrice(prev =>
          prev !== null ? prev + deltaRef.current * 0.5 : null
        );
      }
    }, TICK_INTERVAL_MS);
  }, []);

  const stopTicking = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // One-time: seed refs from localStorage
  useEffect(() => {
    const stored = readStorage();
    if (stored) {
      deltaRef.current = stored.delta;
      lastTruePriceRef.current = stored.price;
      lastTimestampRef.current = stored.timestamp;
      initializedFromStorageRef.current = true;
    }
  }, []);

  // Handle true price updates
  useEffect(() => {
    if (truePrice === null) {
      setDisplayPrice(null);
      stopTicking();
      return;
    }

    const now = Date.now();
    const prevPrice = lastTruePriceRef.current;
    const prevTimestamp = lastTimestampRef.current;

    if (prevPrice !== null && prevTimestamp !== null) {
      // Subsequent price update
      const elapsedSeconds = (now - prevTimestamp) / 1000;
      if (elapsedSeconds > 0 && truePrice > prevPrice) {
        deltaRef.current = (truePrice - prevPrice) / elapsedSeconds;
      }
      // If truePrice <= prevPrice, keep deltaRef unchanged
    } else if (initializedFromStorageRef.current) {
      // First on-chain price after loading from storage
      const stored = readStorage();
      if (stored && truePrice > stored.price) {
        const elapsedSeconds = (now - stored.timestamp) / 1000;
        if (elapsedSeconds > 0) {
          deltaRef.current = (truePrice - stored.price) / elapsedSeconds;
        }
      }
      // If truePrice <= stored price, keep stored delta (already in deltaRef)
    }

    // Snap display to true price
    setDisplayPrice(truePrice);
    lastTruePriceRef.current = truePrice;
    lastTimestampRef.current = now;
    hasTruePrice.current = true;

    // Persist
    writeStorage({ price: truePrice, timestamp: now, delta: deltaRef.current });

    // Restart ticking from the new snapped price
    stopTicking();
    startTicking();
  }, [truePrice, stopTicking, startTicking]);

  // Tab visibility handling
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopTicking();
      } else if (hasTruePrice.current) {
        // Snap to last true price on return, resume ticking
        if (lastTruePriceRef.current !== null) {
          setDisplayPrice(lastTruePriceRef.current);
        }
        startTicking();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [stopTicking, startTicking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopTicking();
  }, [stopTicking]);

  return { displayPrice };
}
