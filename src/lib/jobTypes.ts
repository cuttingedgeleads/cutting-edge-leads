export const JOB_TYPES = [
  "Grass Maintenance",
  "Landscaping",
  "Grass and Landscape Maintenance",
  "Commercial Grass Maintenance",
  "Commercial Landscape",
  "Commercial Grass and Landscape Maintenance",
] as const;

export type JobType = (typeof JOB_TYPES)[number];
