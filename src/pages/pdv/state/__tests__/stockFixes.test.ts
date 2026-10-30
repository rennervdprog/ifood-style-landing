/**
 * Testes para as 3 correções de estoque (2026-10-10):
 * 1. Drift da migration Fase 1 (stock_movements → product_stock_movements)
 * 2. Refresh do pdv-stock após venda no caixa
 * 3. Trigger do delivery verifica colunas corretas (sem baixa duplicada)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MIGRATIONS_DIR = join(__dirname, '../../../../../supabase/migrations');

describe('Correções de estoque', () => {
  describe('1. Drift da migration Fase 1', () => {
    it('não deve conter referências a stock_movements sem o prefixo product_', () => {
      const content = readFileSync(
        join(MIGRATIONS_DIR, '20261010123500_controle_estoque_fase1.sql'),
        'utf-8'
      );
      // Encontra "stock_movements" que NÃO é precedido por "product_"
      const matches = content.match(/(?<!product_)stock_movements/g);
      expect(matches).toBeNull();
    });

    it('deve referenciar product_stock_movements nas policies', () => {
      const content = readFileSync(
        join(MIGRATIONS_DIR, '20261010123500_controle_estoque_fase1.sql'),
        'utf-8'
      );
      expect(content).toContain('product_stock_movements.store_id');
    });
  });

  describe('2. Refresh do pdv-stock após venda', () => {
    it('usePdvCheckout deve invalidar pdv-stock após venda', () => {
      const content = readFileSync(
        join(__dirname, '../usePdvCheckout.ts'),
        'utf-8'
      );
      // Verifica que há invalidação de pdv-stock
      expect(content).toContain('pdv-stock');
      expect(content).toContain('invalidateQueries');
    });
  });

  describe('3. Trigger do delivery', () => {
    it('deve verificar colunas order_source e pdv_session_id (não apenas metadata)', () => {
      const content = readFileSync(
        join(MIGRATIONS_DIR, '20261010203000_trigger_pdv_columns.sql'),
        'utf-8'
      );
      expect(content).toContain('NEW.pdv_session_id IS NOT NULL');
      expect(content).toContain("NEW.order_source = 'pdv'");
    });

    it('deve manter compatibilidade com metadata', () => {
      const content = readFileSync(
        join(MIGRATIONS_DIR, '20261010203000_trigger_pdv_columns.sql'),
        'utf-8'
      );
      expect(content).toContain("NEW.metadata->>'pdv_session_id'");
    });
  });
});
