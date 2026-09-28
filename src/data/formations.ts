export const ROLES = [
  'GK',
  'LB',
  'LCB',
  'CB',
  'RCB',
  'RB',
  'LWB',
  'RWB',
  'CDM',
  'LDM',
  'RDM',
  'LCM',
  'CM',
  'RCM',
  'LM',
  'RM',
  'LAM',
  'CAM',
  'RAM',
  'LW',
  'RW',
  'LS',
  'ST',
  'RS',
] as const;

export type Role = (typeof ROLES)[number];

export function isRole(v: string): v is Role {
  return (ROLES as readonly string[]).includes(v);
}

export interface FormationSlot {
  role: Role;
  nx: number;
  ny: number;
}

/** Always 11 slots, the first one is the goalkeeper. */
export interface Formation {
  id: string;
  name: string;
  slots: FormationSlot[];
}

type SlotTuple = [Role, number, number];

const GK: SlotTuple = ['GK', 0.05, 0.5];

function formation(id: string, outfield: SlotTuple[]): Formation {
  const slots = [GK, ...outfield].map(([role, nx, ny]) => ({ role, nx, ny }));
  if (slots.length !== 11) throw new Error(`Formation ${id} must have 11 slots`);
  return { id, name: id, slots };
}

const BACK_FOUR: SlotTuple[] = [
  ['LB', 0.25, 0.12],
  ['LCB', 0.22, 0.37],
  ['RCB', 0.22, 0.63],
  ['RB', 0.25, 0.88],
];

export const FORMATIONS: readonly Formation[] = [
  formation('4-4-2', [
    ...BACK_FOUR,
    ['LM', 0.45, 0.12],
    ['LCM', 0.42, 0.38],
    ['RCM', 0.42, 0.62],
    ['RM', 0.45, 0.88],
    ['LS', 0.62, 0.4],
    ['RS', 0.62, 0.6],
  ]),
  formation('4-3-3', [
    ...BACK_FOUR,
    ['CDM', 0.36, 0.5],
    ['LCM', 0.45, 0.32],
    ['RCM', 0.45, 0.68],
    ['LW', 0.65, 0.13],
    ['ST', 0.68, 0.5],
    ['RW', 0.65, 0.87],
  ]),
  formation('4-2-3-1', [
    ...BACK_FOUR,
    ['LDM', 0.38, 0.4],
    ['RDM', 0.38, 0.6],
    ['LAM', 0.55, 0.15],
    ['CAM', 0.55, 0.5],
    ['RAM', 0.55, 0.85],
    ['ST', 0.68, 0.5],
  ]),
  formation('4-1-4-1', [
    ...BACK_FOUR,
    ['CDM', 0.33, 0.5],
    ['LM', 0.47, 0.12],
    ['LCM', 0.47, 0.38],
    ['RCM', 0.47, 0.62],
    ['RM', 0.47, 0.88],
    ['ST', 0.66, 0.5],
  ]),
  formation('3-5-2', [
    ['LCB', 0.22, 0.28],
    ['CB', 0.2, 0.5],
    ['RCB', 0.22, 0.72],
    ['LWB', 0.42, 0.08],
    ['LCM', 0.44, 0.32],
    ['CM', 0.38, 0.5],
    ['RCM', 0.44, 0.68],
    ['RWB', 0.42, 0.92],
    ['LS', 0.64, 0.4],
    ['RS', 0.64, 0.6],
  ]),
  formation('3-4-3', [
    ['LCB', 0.22, 0.28],
    ['CB', 0.2, 0.5],
    ['RCB', 0.22, 0.72],
    ['LWB', 0.42, 0.1],
    ['LCM', 0.42, 0.38],
    ['RCM', 0.42, 0.62],
    ['RWB', 0.42, 0.9],
    ['LW', 0.64, 0.18],
    ['ST', 0.68, 0.5],
    ['RW', 0.64, 0.82],
  ]),
  formation('5-3-2', [
    ['LWB', 0.28, 0.08],
    ['LCB', 0.22, 0.3],
    ['CB', 0.2, 0.5],
    ['RCB', 0.22, 0.7],
    ['RWB', 0.28, 0.92],
    ['LCM', 0.42, 0.3],
    ['CM', 0.4, 0.5],
    ['RCM', 0.42, 0.7],
    ['LS', 0.6, 0.4],
    ['RS', 0.6, 0.6],
  ]),
];

export const DEFAULT_FORMATION_ID = '4-4-2';

export function getFormation(id: string): Formation | undefined {
  return FORMATIONS.find((f) => f.id === id);
}

/** Conventional shirt numbers per role, used for new squads. */
export const DEFAULT_NUMBERS: Partial<Record<Role, number>> = {
  GK: 1,
  RB: 2,
  LB: 3,
  LCB: 4,
  RCB: 5,
  RCM: 6,
  RM: 7,
  LCM: 8,
  RS: 9,
  LS: 10,
  LM: 11,
};
