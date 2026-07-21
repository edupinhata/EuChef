import type { MeasurementUnit } from "../../api/types";

export const measurementUnits: Array<{
  value: MeasurementUnit;
  label: string;
}> = [
  { value: "GRAM", label: "Grama (g)" },
  { value: "KILOGRAM", label: "Quilograma (kg)" },
  { value: "MILLILITER", label: "Mililitro (ml)" },
  { value: "LITER", label: "Litro (l)" },
  { value: "UNIT", label: "Unidade" },
  { value: "TABLESPOON", label: "Colher de sopa" },
  { value: "TEASPOON", label: "Colher de chá" },
  { value: "CUP", label: "Xícara" },
  { value: "PINCH", label: "Pitada" },
];
