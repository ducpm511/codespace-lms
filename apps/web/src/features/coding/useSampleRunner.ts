import { useCallback, useEffect, useRef, useState } from 'react';
import type { SampleTestCaseDto } from '@lms/contracts';

export interface SampleRunResult {
  order: number;
  name?: string | null;
  passed: boolean;
  actualStdout: string;
  error?: string | null;
}

interface WorkerResult {
  id: number;
  type: 'result' | 'error';
  results?: SampleRunResult[];
  error?: string;
}

/**
 * Quản lý Pyodide worker (public/pyodide.worker.js) để chạy thử sample test trên trình duyệt.
 * PREVIEW ONLY — không tính điểm. Điểm chính thức do server autograder tính lại.
 */
export function useSampleRunner() {
  const workerRef = useRef<Worker | null>(null);
  const seq = useRef(0);
  const pending = useRef(new Map<number, (r: WorkerResult) => void>());
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const worker = new Worker('/pyodide.worker.js', { type: 'module' });
    worker.onmessage = (ev: MessageEvent<WorkerResult>) => {
      const resolve = pending.current.get(ev.data.id);
      if (resolve) {
        pending.current.delete(ev.data.id);
        resolve(ev.data);
      }
    };
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
      pending.current.clear();
    };
  }, []);

  const run = useCallback(
    (code: string, samples: SampleTestCaseDto[]): Promise<SampleRunResult[]> => {
      const worker = workerRef.current;
      if (!worker) {
        return Promise.reject(new Error('runner-not-ready'));
      }
      const id = ++seq.current;
      setRunning(true);
      return new Promise<SampleRunResult[]>((resolve, reject) => {
        pending.current.set(id, (msg) => {
          setRunning(false);
          if (msg.type === 'error') {
            reject(new Error(msg.error || 'run-failed'));
          } else {
            resolve(msg.results ?? []);
          }
        });
        worker.postMessage({
          id,
          code,
          samples: samples.map((s) => ({
            order: s.order,
            name: s.name,
            stdin: s.stdin,
            expectedStdout: s.expectedStdout,
          })),
        });
      });
    },
    [],
  );

  return { run, running };
}
