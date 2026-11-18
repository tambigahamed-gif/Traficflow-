export const AI_GENERATION_TASKS = [
  "idea",
  "caption",
  "platform_variant",
  "metadata",
  "editorial_calendar",
  "content_review",
] as const;

export type AiGenerationTask = (typeof AI_GENERATION_TASKS)[number];

export const AI_GENERATION_TASK_LABELS: Record<AiGenerationTask, string> = {
  idea: "Trouver des idées",
  caption: "Rédiger une publication",
  platform_variant: "Adapter au compte sélectionné",
  metadata: "Titre, description, CTA et hashtags",
  editorial_calendar: "Préparer un calendrier éditorial",
  content_review: "Analyser un contenu fourni",
};
