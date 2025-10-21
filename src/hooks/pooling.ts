import { useCallback, useEffect, useRef, useState } from 'react';

export type conditionCallbackFunc<T = void> = (
  onSuccess: (payload?: T) => void,
  onError: (error?: Error) => void,
  onContinue: () => void,
) => Promise<T | void> | void;

export type PoolingAsyncFunc = <T = void>(
  conditionCallback: conditionCallbackFunc<T>,
  interval: number,
  timeout: number,
) => Promise<T | void>;

type PoolingAsyncType = {
  isPooling: boolean;
  startPooling: PoolingAsyncFunc;
};

const usePoolingAsync = (): PoolingAsyncType => {
  const poolingRef = useRef<ReturnType<typeof setTimeout>>();
  const timeoutRef = useRef<number>();
  const [isPooling, setPooling] = useState(false);

  const startPooling: PoolingAsyncFunc = useCallback(
    <T = void>(
      conditionCallback: conditionCallbackFunc<T>,
      interval: number,
      timeout: number,
    ) => {
      return new Promise<T | void>((resolve, reject) => {
        timeoutRef.current = Date.now();
        setPooling(true);

        const endPooling = () => {
          setPooling(false);

          if (poolingRef.current) {
            clearTimeout(poolingRef.current);
          }
        };

        const onSuccess = (payload?: T) => {
          resolve(payload);
          endPooling();
        };

        const onError = (error?: Error) => {
          reject(error ?? new Error('Invalid Condition'));
          endPooling();
        };

        const onContinue = () => {
          const hasTimedout = !!(
            timeoutRef.current && Date.now() - timeoutRef.current > timeout
          );

          if (!hasTimedout) {
            poolingRef.current = setTimeout(
              () => conditionCallback(onSuccess, onError, onContinue),
              interval,
            );
            return;
          }

          reject(new Error('Timeout'));
          endPooling();
        };

        conditionCallback(onSuccess, onError, onContinue);
      });
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (poolingRef.current) {
        clearTimeout(poolingRef.current);
      }
    };
  }, []);

  return { isPooling, startPooling };
};

export { usePoolingAsync };
