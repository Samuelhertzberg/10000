import { useState, useEffect } from 'react';

const useLocalStorageState = <T,>(key: string, initialValue: T): [T, (value: T) => void] => {
    const [state, setState] = useState<T>(() => {
        const storedValue = localStorage.getItem(key);
        return storedValue ? JSON.parse(storedValue) : initialValue;
    });

    useEffect(() => {
        localStorage.setItem(key, JSON.stringify(state));
    }, [key, state]);

    return [state, setState];
};

export default useLocalStorageState;