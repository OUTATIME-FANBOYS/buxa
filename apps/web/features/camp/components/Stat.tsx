export function Stat({ label, value }: { label: string; value: string }) {
  return <div className="stat"><div className="stat-top"><span className="stat-label">{label}</span></div><span className="stat-num">{value}</span></div>;
}
