 import { useState, useEffect, useCallback } from "react";
 
 export const PIX_CHARGE_TTL_MS = 5 * 60 * 1000;
 
 export interface ChargeResult {
   qr_code: string | null;
   qr_code_base64: string | null;
   reference_code: string;
   amount: number;
   created_at: string;
   status: string;
 }
 
 export interface FinancialTransaction {
   id: string;
   amount: number;
   created_at: string;
   pix_copy_paste: string | null;
   pix_qr_code: string | null;
   pix_qr_code_base64: string | null;
   reference_code: string;
   status: string;
   transaction_kind: string;
 }
 
 export const getPendingChargeRemainingMs = (createdAt: string, nowMs = Date.now()) =>
   Math.max(0, new Date(createdAt).getTime() + PIX_CHARGE_TTL_MS - nowMs);
 
 export const isPendingChargeExpired = (status: string, createdAt: string, nowMs = Date.now()) =>
   status === "pending" && getPendingChargeRemainingMs(createdAt, nowMs) === 0;
 
 export const formatCountdown = (remainingMs: number) => {
   const totalSeconds = Math.ceil(remainingMs / 1000);
   const minutes = Math.floor(totalSeconds / 60);
   const seconds = totalSeconds % 60;
   return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
 };
 
 export const mapTransactionToChargeResult = (transaction: FinancialTransaction): ChargeResult => ({
   qr_code: transaction.pix_copy_paste || transaction.pix_qr_code,
   qr_code_base64: transaction.pix_qr_code_base64,
   reference_code: transaction.reference_code,
   amount: Number(transaction.amount || 0),
   created_at: transaction.created_at,
   status: transaction.status,
 });
 
 export const getTransactionStatusMeta = (status: string, createdAt: string, nowMs = Date.now()) => {
   if (isPendingChargeExpired(status, createdAt, nowMs)) {
     return { label: "Expirada", className: "bg-red-500/20 text-red-400 border-red-500/30", isExpired: true };
   }
   if (status === "paid" || status === "approved") {
     return { label: "Pago", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", isExpired: false };
   }
   if (status === "failed" || status === "cancelled") {
     return {
       label: status === "cancelled" ? "Cancelada" : "Falhou",
       className: "bg-red-500/20 text-red-400 border-red-500/30",
       isExpired: status === "cancelled",
     };
   }
   return { label: "Pendente", className: "bg-amber-500/20 text-amber-400 border-amber-500/30", isExpired: false };
 };
 
 export function usePixCharge() {
   const [nowMs, setNowMs] = useState(() => Date.now());
 
   useEffect(() => {
     const interval = setInterval(() => setNowMs(Date.now()), 1000);
     return () => clearInterval(interval);
   }, []);
 
   return { nowMs };
 }