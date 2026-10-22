type StatProps = {
  label: string;
  value: string;
};

/** Показатель внутри карточки результата. */
export function Stat({ label, value }: StatProps) {
  return (
    <div className="stat">
      <dt className="stat__label">{label}</dt>
      <dd className="stat__value">{value}</dd>
    </div>
  );
}
