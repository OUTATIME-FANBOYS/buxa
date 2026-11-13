export function Legend({ items }: { items: { name: string; className: string }[] }) {
  return <div className="legend">{items.map(i => <span key={i.name}><i className={`sw ${i.className}`} />{i.name}</span>)}</div>;
}
