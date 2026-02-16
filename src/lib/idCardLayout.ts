export const PX_PER_MM = 96 / 25.4; // 3.7795... at 96 DPI

export type IDCardOrientation = 'portrait' | 'landscape';
export type IDCardElementType = 'text' | 'photo' | 'logo';

export type IDCardAlign = 'left' | 'center' | 'right';

export interface IDCardElement {
  id: string;
  type: IDCardElementType;
  label: string;
  templateField?: string;
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  color?: string;
  align?: IDCardAlign;
}

export interface IDCardLayout {
  id?: string;
  name: string;
  width_mm: number;
  height_mm: number;
  orientation: IDCardOrientation;
  backgroundImageUrl?: string;
  elements: IDCardElement[];
  fieldMappings: Record<string, string>;
}

function toNumber(value: any, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeLayout(input: any, fallback?: Partial<IDCardLayout>): IDCardLayout {
  const fb: Partial<IDCardLayout> = fallback || {};

  // If backend already returned normalized layout, keep it.
  if (input && typeof input === 'object' && Array.isArray(input.elements) && input.fieldMappings) {
    return {
      id: input.id ?? fb.id,
      name: input.name ?? fb.name ?? 'Template',
      width_mm: toNumber(input.width_mm ?? fb.width_mm, 54),
      height_mm: toNumber(input.height_mm ?? fb.height_mm, 86),
      orientation: (input.orientation ?? fb.orientation ?? 'portrait') as IDCardOrientation,
      backgroundImageUrl: input.backgroundImageUrl ?? fb.backgroundImageUrl,
      elements: input.elements.map((el: any) => normalizeElement(el)),
      fieldMappings: input.fieldMappings ?? {},
    };
  }

  const legacy = input && typeof input === 'object' ? input : {};
  const legacyMappings = legacy.field_mappings || legacy.fieldMappings || {};

  return {
    id: fb.id,
    name: legacy.name ?? fb.name ?? 'Template',
    width_mm: toNumber(legacy.width_mm ?? fb.width_mm, 54),
    height_mm: toNumber(legacy.height_mm ?? fb.height_mm, 86),
    orientation: (legacy.orientation ?? fb.orientation ?? 'portrait') as IDCardOrientation,
    backgroundImageUrl: legacy.backgroundImageUrl ?? fb.backgroundImageUrl,
    elements: Array.isArray(legacy.elements) ? legacy.elements.map((el: any) => normalizeElement(el)) : [],
    fieldMappings: legacyMappings || {},
  };
}

export function normalizeElement(el: any): IDCardElement {
  const typeRaw = el?.type;
  const type: IDCardElementType =
    typeRaw === 'photo' ? 'photo' :
    typeRaw === 'logo' ? 'logo' :
    'text';

  const x = el?.x_percent ?? el?.x ?? 0;
  const y = el?.y_percent ?? el?.y ?? 0;
  const w = el?.width_percent ?? el?.width ?? 0;
  const h = el?.height_percent ?? el?.height ?? 0;

  // Ensure photo elements always have templateField = "photo"
  let templateField = el?.templateField ?? el?.template_field ?? el?.field;
  if (type === 'photo' && !templateField) {
    templateField = 'photo';
  }

  return {
    id: String(el?.id ?? ''),
    type,
    label: String(el?.label ?? ''),
    templateField,
    x_percent: toNumber(x, 0),
    y_percent: toNumber(y, 0),
    width_percent: toNumber(w, 0),
    height_percent: toNumber(h, 0),
    fontSize: el?.fontSize !== undefined ? toNumber(el.fontSize, 14) : undefined,
    fontFamily: el?.fontFamily,
    fontWeight: el?.fontWeight,
    color: el?.color,
    align: (el?.align ?? el?.textAlign) as IDCardAlign | undefined,
  };
}

export function getByPath(obj: any, path: string) {
  return String(path).split('.').reduce((acc: any, key: string) => {
    if (acc && typeof acc === 'object') return acc[key];
    return undefined;
  }, obj);
}

/** Common student field aliases so mapping works with snake_case or camelCase from API */
const STUDENT_FIELD_ALIASES: Record<string, string[]> = {
  photo: ['photo', 'photoUrl', 'photo_url'],
  name: ['name'],
  roll_no: ['rollNo', 'roll_no'],
  admission_number: ['admissionNumber', 'admission_number'],
  class: ['class', 'className', 'class_name'],
};

export function resolveElementValue(layout: IDCardLayout, student: any, el: IDCardElement): string {
  const templateField = el.templateField;
  if (!templateField) return '';

  // Prefer backend resolved_fields if present
  const resolved = student?.resolved_fields?.[templateField];
  if (resolved !== undefined && resolved !== null) return String(resolved);

  const mappingPath = layout.fieldMappings?.[templateField] || templateField;
  let val = mappingPath.includes('.') ? getByPath(student, mappingPath) : student?.[mappingPath];
  if (val === undefined || val === null) {
    // Fallback: try common aliases for this templateField (e.g. photo -> photoUrl, photo_url)
    const keys = STUDENT_FIELD_ALIASES[templateField];
    if (keys && student) {
      for (const k of keys) {
        const v = student[k];
        if (v !== undefined && v !== null) {
          val = v;
          break;
        }
      }
    }
  }
  if (val === undefined || val === null) return '';
  return String(val);
}