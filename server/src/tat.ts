export const priorityMultiplier: Record<string, number> = { Urgent: 0.5, High: 0.75, Medium: 1, Low: 1.5 };
export function calculateHours(settings: any, categoryLoad: Record<string, number>, category: string, priority: string) {
  const categoryDef = settings.categories.find((item: any) => item.name === category) || settings.categories[0];
  const pending = categoryLoad[category] || 0;
  const overCapacity = Math.max(0, pending - settings.capacityPerCategory);
  return Math.round(categoryDef.baseHours * (priorityMultiplier[priority] ?? 1) + overCapacity * settings.bufferHoursPerExtraJob);
}
