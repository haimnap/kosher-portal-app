export function StatCard({
  label,
  value,
  accentColor,
  note,
  noteColor,
}: {
  label: string;
  value: number | string;
  accentColor: string;
  note?: string;
  noteColor?: string;
}) {
  return (
    <div
      className="bg-white p-6 rounded-xl shadow-sm"
      style={{ borderTop: `4px solid ${accentColor}` }}
    >
      <div className="text-xs text-slate-400 uppercase tracking-wide mb-2">{label}</div>
      <div className="text-3xl font-bold" style={{ color: accentColor }}>
        {value}
      </div>
      {note && (
        <div className="text-xs mt-2" style={{ color: noteColor || '#999' }}>
          {note}
        </div>
      )}
    </div>
  );
}
