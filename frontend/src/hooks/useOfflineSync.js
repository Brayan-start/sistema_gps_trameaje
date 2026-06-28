import { useEffect, useRef } from "react";
import { getSocket } from "./useSocket";

const DB_NAME = "sanroque_offline";
const STORE_NAME = "pending_positions";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveOffline(data) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).add({ ...data, savedAt: Date.now() });
  await new Promise((resolve) => (tx.oncomplete = resolve));
}

async function getPending() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const all = await new Promise((resolve) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
  });
  return all;
}

async function clearPending() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).clear();
  await new Promise((resolve) => (tx.oncomplete = resolve));
}

export function useOfflineSync() {
  const isOnline = useRef(navigator.onLine);

  useEffect(() => {
    const sync = async () => {
      if (!navigator.onLine) return;

      const pending = await getPending();
      if (pending.length === 0) return;

      const socket = getSocket();
      if (!socket?.connected) return;

      for (const item of pending) {
        socket.emit("gps_update", {
          vehicleId: item.vehicleId,
          lat: item.lat,
          lng: item.lng,
          speed: item.speed,
        });
      }

      await clearPending();
      console.log(`Sincronizados ${pending.length} puntos GPS offline`);
    };

    const handleOnline = () => {
      isOnline.current = true;
      sync();
    };
    const handleOffline = () => {
      isOnline.current = false;
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const saveForLater = async (data) => {
    await saveOffline(data);
  };

  return { saveForLater, isOnline: isOnline.current };
}
