import { useCallback, useMemo, useState } from 'react';

export type Validator<T> = (value: T) => string | null;

// A looser rules map: we accept any Validator that can handle the field type.
// Using the specific generic argument per key would force callers to add index
// signatures to their form value interfaces.
export type ValidationRules<V> = {
  [K in keyof V]?: (value: V[K]) => string | null;
};

export type FieldErrors<V> = {
  [K in keyof V]?: string | null;
};

// Validators
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IPV4_RE =
  /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/;
const IPV6_RE = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::1|::)$/;
const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

function isEmptyValue(v: unknown): boolean {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
}

export const validators = {
  isNotEmpty:
    (message = 'This field is required'): Validator<unknown> =>
    (value) =>
      isEmptyValue(value) ? message : null,
  isEmail:
    (message = 'Invalid email address'): Validator<string> =>
    (value) => {
      if (isEmptyValue(value)) return null;
      return EMAIL_RE.test(String(value)) ? null : message;
    },
  hasLength:
    (
      opts: { min?: number; max?: number },
      message?: string,
    ): Validator<string> =>
    (value) => {
      const s = String(value ?? '');
      if (opts.min !== undefined && s.length < opts.min) {
        return message ?? `Must be at least ${opts.min} characters`;
      }
      if (opts.max !== undefined && s.length > opts.max) {
        return message ?? `Must be at most ${opts.max} characters`;
      }
      return null;
    },
  isInRange:
    (
      opts: { min?: number; max?: number },
      message?: string,
    ): Validator<number | string | null | undefined> =>
    (value) => {
      if (isEmptyValue(value)) return null;
      const n = Number(value);
      if (Number.isNaN(n)) return message ?? 'Must be a number';
      if (opts.min !== undefined && n < opts.min) {
        return message ?? `Must be at least ${opts.min}`;
      }
      if (opts.max !== undefined && n > opts.max) {
        return message ?? `Must be at most ${opts.max}`;
      }
      return null;
    },
  matches:
    (pattern: RegExp, message = 'Invalid format'): Validator<string> =>
    (value) => {
      if (isEmptyValue(value)) return null;
      return pattern.test(String(value)) ? null : message;
    },
  isPort: (message = 'Port must be between 1 and 65535'): Validator<number | string | null | undefined> => (value) => {
    if (isEmptyValue(value)) return null;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 65535) return message;
    return null;
  },
  isUrl: (message = 'Invalid URL'): Validator<string> => (value) => {
    if (isEmptyValue(value)) return null;
    return URL_RE.test(String(value)) ? null : message;
  },
  isUuid: (message = 'Invalid UUID'): Validator<string> => (value) => {
    if (isEmptyValue(value)) return null;
    return UUID_RE.test(String(value)) ? null : message;
  },
  isIpAddress:
    (message = 'Invalid IP address'): Validator<string> =>
    (value) => {
      if (isEmptyValue(value)) return null;
      const s = String(value);
      return IPV4_RE.test(s) || IPV6_RE.test(s) ? null : message;
    },
  isHostOrIp:
    (message = 'Invalid host or IP'): Validator<string> =>
    (value) => {
      if (isEmptyValue(value)) return null;
      const s = String(value);
      return IPV4_RE.test(s) || IPV6_RE.test(s) || DOMAIN_RE.test(s)
        ? null
        : message;
    },
  isJson:
    (message = 'Must be valid JSON'): Validator<string> =>
    (value) => {
      if (isEmptyValue(value)) return null;
      try {
        JSON.parse(String(value));
        return null;
      } catch {
        return message;
      }
    },
  combine:
    <T>(...list: Validator<T>[]): Validator<T> =>
    (value) => {
      for (const fn of list) {
        const res = fn(value);
        if (res) return res;
      }
      return null;
    },
};

export interface UseFormValidationResult<V extends object> {
  values: V;
  errors: FieldErrors<V>;
  isValid: boolean;
  touched: Partial<Record<keyof V, boolean>>;
  setFieldValue: <K extends keyof V>(key: K, value: V[K]) => void;
  setFieldTouched: <K extends keyof V>(key: K, touched?: boolean) => void;
  setValues: (values: Partial<V>) => void;
  reset: (values?: Partial<V>) => void;
  validate: () => boolean;
  getInputProps: <K extends keyof V>(
    key: K,
    opts?: { type?: 'input' | 'number' | 'checkbox' },
  ) => {
    value: V[K] | undefined;
    error: string | null | undefined;
    onChange: (e: unknown) => void;
    onBlur: () => void;
  };
}

export function useFormValidation<V extends object>(
  initialValues: V,
  rules: ValidationRules<V> = {},
): UseFormValidationResult<V> {
  const [values, setValuesState] = useState<V>(initialValues);
  const [touched, setTouched] = useState<Partial<Record<keyof V, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const errors: FieldErrors<V> = useMemo(() => {
    const out: FieldErrors<V> = {};
    for (const key in rules) {
      const fn = rules[key];
      if (!fn) continue;
      const err = fn(values[key] as V[typeof key]);
      if (err) out[key] = err;
    }
    return out;
  }, [values, rules]);

  const isValid = useMemo(
    () => Object.values(errors).every((v) => v == null),
    [errors],
  );

  const setFieldValue = useCallback(
    <K extends keyof V>(key: K, value: V[K]) => {
      setValuesState((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const setFieldTouched = useCallback(
    <K extends keyof V>(key: K, isTouched = true) => {
      setTouched((prev) => ({ ...prev, [key]: isTouched }));
    },
    [],
  );

  const setValues = useCallback((next: Partial<V>) => {
    setValuesState((prev) => ({ ...prev, ...next }));
  }, []);

  const reset = useCallback(
    (next?: Partial<V>) => {
      setValuesState({ ...initialValues, ...(next ?? {}) });
      setTouched({});
      setSubmitted(false);
    },
    [initialValues],
  );

  const validate = useCallback((): boolean => {
    setSubmitted(true);
    const allTouched: Partial<Record<keyof V, boolean>> = {};
    for (const key in values) {
      allTouched[key] = true;
    }
    setTouched(allTouched);
    return Object.values(errors).every((v) => v == null);
  }, [values, errors]);

  const getInputProps = useCallback(
    <K extends keyof V>(
      key: K,
      opts?: { type?: 'input' | 'number' | 'checkbox' },
    ) => {
      const type = opts?.type ?? 'input';
      const shouldShowError = submitted || touched[key];
      return {
        value: values[key],
        error: shouldShowError ? errors[key] ?? null : null,
        onChange: (e: unknown) => {
          if (type === 'checkbox') {
            const target =
              e && typeof e === 'object' && 'currentTarget' in e
                ? (e as { currentTarget: HTMLInputElement }).currentTarget
                : null;
            setFieldValue(key, (target ? target.checked : Boolean(e)) as V[K]);
          } else if (type === 'number') {
            // Mantine NumberInput passes value directly
            setFieldValue(key, e as V[K]);
          } else if (
            e &&
            typeof e === 'object' &&
            'currentTarget' in e
          ) {
            const target = (e as { currentTarget: HTMLInputElement })
              .currentTarget;
            setFieldValue(key, target.value as V[K]);
          } else {
            setFieldValue(key, e as V[K]);
          }
        },
        onBlur: () => setFieldTouched(key, true),
      };
    },
    [values, errors, touched, submitted, setFieldValue, setFieldTouched],
  );

  return {
    values,
    errors,
    isValid,
    touched,
    setFieldValue,
    setFieldTouched,
    setValues,
    reset,
    validate,
    getInputProps,
  };
}
