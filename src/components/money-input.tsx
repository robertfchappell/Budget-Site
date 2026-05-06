"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type MoneyInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "defaultValue" | "inputMode" | "onChange" | "type" | "value"
> & {
  allowNegative?: boolean;
  defaultValue?: number | string | null;
  label?: string;
  wrapperClassName?: string;
};

export function MoneyInput({
  allowNegative = false,
  className = "field",
  defaultValue,
  id,
  label,
  name,
  wrapperClassName,
  ...props
}: MoneyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const initialValue = useMemo(
    () => formatMoneyInput(defaultValue, allowNegative),
    [allowNegative, defaultValue]
  );
  const [displayValue, setDisplayValue] = useState(initialValue);
  const inputId = id ?? name;

  useEffect(() => {
    const input = inputRef.current;
    const form = input?.form;

    if (!form) {
      return;
    }

    function handleReset() {
      window.requestAnimationFrame(() => setDisplayValue(initialValue));
    }

    form.addEventListener("reset", handleReset);
    return () => form.removeEventListener("reset", handleReset);
  }, [initialValue]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const caret = input.selectionStart ?? input.value.length;
    const rawCaretIndex = countMoneyCharacters(input.value.slice(0, caret), allowNegative);
    const formatted = formatMoneyInput(input.value, allowNegative);

    setDisplayValue(formatted);

    window.requestAnimationFrame(() => {
      const nextCaret = caretFromMoneyCharacterIndex(formatted, rawCaretIndex, allowNegative);
      inputRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  }

  const input = (
    <input
      {...props}
      className={className}
      id={inputId}
      inputMode="decimal"
      name={name}
      onChange={handleChange}
      ref={inputRef}
      type="text"
      value={displayValue}
    />
  );

  if (!label) {
    return input;
  }

  return (
    <div className={wrapperClassName}>
      <label className="label" htmlFor={inputId}>
        {label}
      </label>
      {input}
    </div>
  );
}

function formatMoneyInput(value: number | string | null | undefined, allowNegative: boolean) {
  const sanitized = sanitizeMoneyInput(value, allowNegative);

  if (!sanitized || sanitized === "-") {
    return sanitized;
  }

  const negative = sanitized.startsWith("-");
  const unsigned = negative ? sanitized.slice(1) : sanitized;
  const [integerPart = "", decimalPart = ""] = unsigned.split(".");
  const hasDecimal = unsigned.includes(".");
  const integer = integerPart || "0";
  const formattedInteger = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    useGrouping: true
  }).format(Number(integer));

  return `${negative ? "-" : ""}${formattedInteger}${hasDecimal ? `.${decimalPart}` : ""}`;
}

function sanitizeMoneyInput(value: number | string | null | undefined, allowNegative: boolean) {
  const text = String(value ?? "").trim();

  if (!text) {
    return "";
  }

  let output = "";
  let hasDecimal = false;
  let hasNegative = false;

  for (const char of text.replace(/[$,\s]/g, "")) {
    if (char >= "0" && char <= "9") {
      output += char;
      continue;
    }

    if (char === "." && !hasDecimal) {
      output += ".";
      hasDecimal = true;
      continue;
    }

    if (char === "-" && allowNegative && !output && !hasNegative) {
      hasNegative = true;
    }
  }

  const negativePrefix = hasNegative ? "-" : "";

  if (!output) {
    return negativePrefix;
  }

  const hasTrailingDecimal = output.endsWith(".");
  const [rawInteger = "", rawDecimal = ""] = output.split(".");
  const integer = rawInteger.replace(/^0+(?=\d)/, "") || (hasDecimal ? "0" : "");
  const decimal = rawDecimal.slice(0, 2);

  if (hasDecimal) {
    return `${negativePrefix}${integer}${hasTrailingDecimal ? "." : `.${decimal}`}`;
  }

  return `${negativePrefix}${integer}`;
}

function countMoneyCharacters(value: string, allowNegative: boolean) {
  return sanitizeMoneyInput(value, allowNegative).length;
}

function caretFromMoneyCharacterIndex(value: string, rawIndex: number, allowNegative: boolean) {
  if (rawIndex <= 0) {
    return 0;
  }

  let seen = 0;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if ((char >= "0" && char <= "9") || char === "." || (allowNegative && char === "-")) {
      seen += 1;
    }

    if (seen >= rawIndex) {
      return index + 1;
    }
  }

  return value.length;
}
