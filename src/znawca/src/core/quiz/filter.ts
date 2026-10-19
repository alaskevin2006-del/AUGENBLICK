import type { CourseObject, FilterSelection } from "./types";
import { normalizeText } from "./types";

function valuesFor(object: CourseObject, field: string): readonly string[] {
  return object.filters?.[field] ?? object.attributes[field] ?? [];
}

export function applyFilters(
  objects: readonly CourseObject[],
  selections: readonly FilterSelection[],
): CourseObject[] {
  return objects.filter((object) =>
    selections.every((selection) => {
      const selected = new Set(selection.values.map(normalizeText));
      return valuesFor(object, selection.field).some((value) => selected.has(normalizeText(value)));
    }),
  );
}

export function findNonDiscriminatingFields(
  objects: readonly CourseObject[],
  fields: readonly string[],
): string[] {
  return fields.filter((field) => {
    const signatures = new Set(
      objects
        .map((object) => object.attributes[field] ?? [])
        .filter((values) => values.length > 0)
        .map((values) => values.map(normalizeText).sort().join("\u0000")),
    );
    return signatures.size <= 1;
  });
}
