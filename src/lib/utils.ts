import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function toFiniteNumber(value: number | string | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toCents(value: number | string | null | undefined) {
  return Math.round(toFiniteNumber(value) * 100);
}

export function fromCents(cents: number) {
  return cents / 100;
}

export function addMoney(...values: Array<number | string | null | undefined>) {
  return fromCents(values.reduce<number>((sum, value) => sum + toCents(value), 0));
}

export function subtractMoney(
  value: number | string | null | undefined,
  ...values: Array<number | string | null | undefined>
) {
  return fromCents(values.reduce<number>((sum, current) => sum - toCents(current), toCents(value)));
}

export function sumMoney(values: Array<number | string | null | undefined>) {
  return fromCents(values.reduce<number>((sum, value) => sum + toCents(value), 0));
}

export function multiplyMoney(value: number | string | null | undefined, multiplier: number) {
  return fromCents(Math.round(toCents(value) * multiplier));
}

export function averageMoney(value: number | string | null | undefined, count: number) {
  if (!count) return 0;
  return fromCents(Math.round(toCents(value) / count));
}

 export function formatBRL(value: number | string | null | undefined) {
   const num = typeof value === "number" ? value : fromCents(toCents(value));
   return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
 }
 
 export const formatCurrency = formatBRL;
