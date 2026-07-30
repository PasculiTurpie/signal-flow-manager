import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook para manejar una cola de operaciones pendientes cuando no hay conexión
 * @param {boolean} isOnline - Estado de conexión
 * @returns {{
 *   enqueue: (operation) => void,
 *   queueSize: number,
 *   isProcessing: boolean,
 *   clearQueue: () => void
 * }}
 */
export function useOfflineQueue(isOnline) {
  const [queue, setQueue] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef(false);

  // Cargar queue del localStorage al montar
  useEffect(() => {
    try {
      const stored = localStorage.getItem('diagramflow-offline-queue');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setQueue(parsed);
        }
      }
    } catch (error) {
      console.error('Error loading offline queue:', error);
    }
  }, []);

  // Guardar queue en localStorage cuando cambia
  useEffect(() => {
    try {
      if (queue.length > 0) {
        localStorage.setItem('diagramflow-offline-queue', JSON.stringify(queue));
      } else {
        localStorage.removeItem('diagramflow-offline-queue');
      }
    } catch (error) {
      console.error('Error saving offline queue:', error);
    }
  }, [queue]);

  // Procesar queue cuando vuelve la conexión
  useEffect(() => {
    if (isOnline && queue.length > 0 && !processingRef.current) {
      processQueue();
    }
  }, [isOnline, queue.length]);

  const enqueue = useCallback((operation) => {
    const timestamp = Date.now();
    const id = `${operation.type}-${operation.entityId}-${timestamp}`;

    setQueue((prev) => {
      // Evitar duplicados
      const exists = prev.some(
        (op) =>
          op.type === operation.type &&
          op.entityId === operation.entityId &&
          (timestamp - op.timestamp) < 5000 // 5 segundos de ventana
      );

      if (exists) {
        return prev;
      }

      return [...prev, { ...operation, id, timestamp }];
    });
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current || queue.length === 0) {
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);

    const operations = [...queue];
    const failed = [];

    for (const operation of operations) {
      try {
        await operation.execute();
        // Éxito: remover de la cola
        setQueue((prev) => prev.filter((op) => op.id !== operation.id));
      } catch (error) {
        console.error('Failed to execute queued operation:', error);
        failed.push(operation);
      }
    }

    // Si hay operaciones fallidas, mantenerlas en la cola
    if (failed.length > 0) {
      setQueue(failed);
    }

    processingRef.current = false;
    setIsProcessing(false);
  }, [queue]);

  const clearQueue = useCallback(() => {
    setQueue([]);
    localStorage.removeItem('diagramflow-offline-queue');
  }, []);

  return {
    enqueue,
    queueSize: queue.length,
    isProcessing,
    clearQueue,
  };
}
