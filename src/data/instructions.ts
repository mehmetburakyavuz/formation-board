/**
 * Quick player instructions shown as badges under the player label.
 * To add one: append an id here and its Turkish label in `tr.instructions`
 * (TypeScript enforces the label).
 */
export const INSTRUCTIONS = [
  'overlap',
  'cutInside',
  'pressHigh',
  'holdPosition',
  'manMark',
  'runInBehind',
  'stayWide',
  'demandBall',
  'freeRole',
] as const;

export type InstructionId = (typeof INSTRUCTIONS)[number];

export function isInstruction(v: string): v is InstructionId {
  return (INSTRUCTIONS as readonly string[]).includes(v);
}
