'use client';

const ALL_SIZES = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'];

interface SizeTableProps {
  value: Record<string, number>;
  onChange?: (val: Record<string, number>) => void;
  readOnly?: boolean;
  sizes?: string[];
}

export default function SizeTable({ value, onChange, readOnly = false, sizes: sizesProp }: SizeTableProps) {
  const SIZES = (sizesProp && sizesProp.length > 0) ? sizesProp : ALL_SIZES;
  const total = SIZES.reduce((s, sz) => s + (Number(value[sz]) || 0), 0);

  const handleChange = (size: string, raw: string) => {
    const num = parseInt(raw) || 0;
    onChange?.({ ...value, [size]: num });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50">
            {SIZES.map(sz => (
              <th key={sz} className="px-2 py-2 text-center font-semibold text-slate-600 border border-slate-200 min-w-[52px]">
                {sz}
              </th>
            ))}
            <th className="px-3 py-2 text-center font-bold text-slate-700 border border-slate-200 bg-blue-50 min-w-[60px]">
              Toplam
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            {SIZES.map(sz => (
              <td key={sz} className="border border-slate-200 p-1">
                {readOnly ? (
                  <div className="text-center py-1 font-medium text-slate-700">
                    {value[sz] || 0}
                  </div>
                ) : (
                  <input
                    type="number"
                    min="0"
                    value={value[sz] || ''}
                    onChange={e => handleChange(sz, e.target.value)}
                    placeholder="0"
                    className="w-full text-center py-1.5 border-0 outline-none bg-transparent focus:bg-blue-50 rounded text-slate-700 font-medium"
                  />
                )}
              </td>
            ))}
            <td className="border border-slate-200 p-1 bg-blue-50">
              <div className="text-center py-1 font-bold text-blue-700">{total}</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
