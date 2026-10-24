import type { SegmentKind } from '../../explain/segments'

/** 各类段的配色：报文结构色块、表格徽标、详情里的子段编号共用。选中态为反白实心。 */
export const KIND_STYLES: Record<SegmentKind, { soft: string; solid: string; ring: string; text: string; swatch: string }> = {
  meta: { soft: 'bg-surface-100 text-surface-700 border-surface-300', solid: 'bg-surface-700 text-white border-surface-700', ring: 'border-surface-500', text: 'text-surface-700', swatch: 'bg-surface-400' },
  mti: { soft: 'bg-violet-50 text-violet-800 border-violet-200', solid: 'bg-violet-800 text-white border-violet-800', ring: 'border-violet-600', text: 'text-violet-800', swatch: 'bg-violet-600' },
  bitmap: { soft: 'bg-orange-50 text-orange-800 border-orange-200', solid: 'bg-orange-800 text-white border-orange-800', ring: 'border-orange-600', text: 'text-orange-800', swatch: 'bg-orange-600' },
  field: { soft: 'bg-blue-50 text-blue-800 border-blue-200', solid: 'bg-blue-800 text-white border-blue-800', ring: 'border-blue-600', text: 'text-blue-800', swatch: 'bg-blue-600' },
}

export const KIND_LEGEND: { kind: SegmentKind; label: string }[] = [
  { kind: 'meta', label: '报文头部' },
  { kind: 'mti', label: 'MTI' },
  { kind: 'bitmap', label: '位图' },
  { kind: 'field', label: '数据域' },
]
