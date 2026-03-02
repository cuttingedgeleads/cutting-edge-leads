export const JOB_TYPES = [
  "Grass Maintenance",
  "Landscaping",
  "Grass and Landscape Maintenance",
  "Commercial Maintenance",
] as const;

export type JobType = (typeof JOB_TYPES)[number];
