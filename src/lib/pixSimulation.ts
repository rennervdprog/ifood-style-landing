/**
 * PIX Simulation Mode
 * 
 * When SIMULATION_MODE is true, all PIX payment flows bypass the real
 * Mercado Pago API and use a local simulation with fake QR codes and
 * a 3-second delay before marking as paid.
 * 
 * TODO: Reativar integração real após liberação do Mercado Pago.
 * Set SIMULATION_MODE = false to restore real payments.
 */

export const SIMULATION_MODE = false;

// Static fake QR code (a simple base64 placeholder)
const FAKE_QR_BASE64 = 
  "iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAABHNCSVQICAgIfAhkiAAAAAlwSFlz" +
  "AAALEwAACxMBAJqcGAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAQ3SURB" +
  "VHic7doxAQAgDACxov5NbwYewAkk7p7ZOQPvOzsBfMkgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALB" +
  "IBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQ" +
  "DALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwC" +
  "wSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAuEFv/YEBDVkwccAAAAASUVO" +
  "RK5CYII=";

const FAKE_PIX_CODE = "00020126580014br.gov.bcb.pix0136SIMULACAO-FOODITA-MODO-TESTE520400005303986540510.005802BR5913FOODITA TESTE6014CIDADE TESTE62070503***6304ABCD";

export function generateFakeReference(prefix: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `#${prefix}-${code}`;
}

export interface SimulatedPixResult {
  qr_code: string;
  qr_code_base64: string;
  reference_code: string;
  amount: number;
  created_at: string;
  status: string;
  payment_id: string;
  simulated: true;
}

export function createSimulatedPixCharge(amount: number, prefix = "SIM"): SimulatedPixResult {
  return {
    qr_code: FAKE_PIX_CODE,
    qr_code_base64: FAKE_QR_BASE64,
    reference_code: generateFakeReference(prefix),
    amount,
    created_at: new Date().toISOString(),
    status: "pending",
    payment_id: `sim_${Date.now()}`,
    simulated: true,
  };
}

export function simulatePaymentDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 3000));
}
