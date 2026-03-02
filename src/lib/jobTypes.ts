export const JOB_TYPES = [
  "Residential Grass Maintenance",
  "Residential Landscaping",
  "Residential Grass and Landscape Maintenance",
  "Commercial Grass Maintenance",
  "Commercial Landscaping",
  "Commercial Grass and Landscape Maintenance",
] as const;

export type JobType = (typeof JOB_TYPES)[number];
