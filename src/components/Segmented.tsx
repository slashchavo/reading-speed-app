type Option<T extends string | number> = { value: T; label: string };

type SegmentedProps<T extends string | number> = {
  name: string;
  legend: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** Группа радиокнопок в виде крупных переключателей — удобно касаться на iPad. */
export function Segmented<T extends string | number>({ name, legend, options, value, onChange }: SegmentedProps<T>) {
  return (
    <fieldset className="choice">
      <legend className="choice__legend">{legend}</legend>
      <div className="segmented">
        {options.map((option) => (
          <label key={String(option.value)} className="segmented__option">
            <input
              type="radio"
              name={name}
              value={String(option.value)}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
