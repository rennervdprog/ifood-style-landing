-- Drop and recreate all triggers safely
DROP TRIGGER IF EXISTS trigger_generate_delivery_pin ON public.orders;
DROP TRIGGER IF EXISTS trigger_generate_collection_code ON public.orders;
DROP TRIGGER IF EXISTS trigger_generate_settlement_code ON public.orders;
DROP TRIGGER IF EXISTS trigger_generate_withdrawal_code ON public.withdrawal_requests;
DROP TRIGGER IF EXISTS trigger_update_store_rating ON public.order_ratings;
DROP TRIGGER IF EXISTS trigger_prevent_role_self_change ON public.profiles;
DROP TRIGGER IF EXISTS trigger_touch_financial_updated_at ON public.financial_transactions;
DROP TRIGGER IF EXISTS trigger_sync_store_balances_legacy ON public.store_balances;
DROP TRIGGER IF EXISTS trigger_sync_profiles ON public.profiles;
DROP TRIGGER IF EXISTS trigger_sync_stores ON public.stores;
DROP TRIGGER IF EXISTS trigger_sync_orders ON public.orders;
DROP TRIGGER IF EXISTS trigger_sync_order_items ON public.order_items;
DROP TRIGGER IF EXISTS trigger_sync_order_messages ON public.order_messages;
DROP TRIGGER IF EXISTS trigger_sync_drivers ON public.drivers;
DROP TRIGGER IF EXISTS trigger_sync_driver_balances ON public.driver_balances;
DROP TRIGGER IF EXISTS trigger_sync_driver_earnings ON public.driver_earnings;
DROP TRIGGER IF EXISTS trigger_sync_financial_transactions ON public.financial_transactions;
DROP TRIGGER IF EXISTS trigger_sync_store_balances ON public.store_balances;
DROP TRIGGER IF EXISTS trigger_sync_withdrawal_requests ON public.withdrawal_requests;
DROP TRIGGER IF EXISTS trigger_sync_neighborhood_fees ON public.neighborhood_fees;
DROP TRIGGER IF EXISTS trigger_sync_products ON public.products;

-- Core business triggers
CREATE TRIGGER trigger_generate_delivery_pin
  BEFORE UPDATE ON public.orders FOR EACH ROW
  EXECUTE FUNCTION public.generate_delivery_pin();

CREATE TRIGGER trigger_generate_collection_code
  BEFORE UPDATE ON public.orders FOR EACH ROW
  EXECUTE FUNCTION public.generate_collection_code();

CREATE TRIGGER trigger_generate_settlement_code
  BEFORE UPDATE ON public.orders FOR EACH ROW
  EXECUTE FUNCTION public.generate_settlement_code();

CREATE TRIGGER trigger_generate_withdrawal_code
  BEFORE INSERT ON public.withdrawal_requests FOR EACH ROW
  EXECUTE FUNCTION public.generate_withdrawal_code();

CREATE TRIGGER trigger_update_store_rating
  AFTER INSERT ON public.order_ratings FOR EACH ROW
  EXECUTE FUNCTION public.update_store_rating();

CREATE TRIGGER trigger_prevent_role_self_change
  BEFORE UPDATE ON public.profiles FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_self_change();

CREATE TRIGGER trigger_touch_financial_updated_at
  BEFORE UPDATE ON public.financial_transactions FOR EACH ROW
  EXECUTE FUNCTION public.touch_financial_transactions_updated_at();

CREATE TRIGGER trigger_sync_store_balances_legacy
  BEFORE INSERT OR UPDATE ON public.store_balances FOR EACH ROW
  EXECUTE FUNCTION public.sync_store_balances_legacy_fields();

-- External sync triggers
CREATE TRIGGER trigger_sync_profiles
  AFTER INSERT OR UPDATE ON public.profiles FOR EACH ROW
  EXECUTE FUNCTION public.notify_record_sync();

CREATE TRIGGER trigger_sync_stores
  AFTER INSERT OR UPDATE ON public.stores FOR EACH ROW
  EXECUTE FUNCTION public.notify_record_sync();

CREATE TRIGGER trigger_sync_orders
  AFTER INSERT OR UPDATE ON public.orders FOR EACH ROW
  EXECUTE FUNCTION public.notify_record_sync();

CREATE TRIGGER trigger_sync_order_items
  AFTER INSERT OR UPDATE ON public.order_items FOR EACH ROW
  EXECUTE FUNCTION public.notify_record_sync();

CREATE TRIGGER trigger_sync_order_messages
  AFTER INSERT OR UPDATE ON public.order_messages FOR EACH ROW
  EXECUTE FUNCTION public.notify_record_sync();

CREATE TRIGGER trigger_sync_drivers
  AFTER INSERT OR UPDATE ON public.drivers FOR EACH ROW
  EXECUTE FUNCTION public.notify_record_sync();

CREATE TRIGGER trigger_sync_driver_balances
  AFTER INSERT OR UPDATE ON public.driver_balances FOR EACH ROW
  EXECUTE FUNCTION public.notify_record_sync();

CREATE TRIGGER trigger_sync_driver_earnings
  AFTER INSERT OR UPDATE ON public.driver_earnings FOR EACH ROW
  EXECUTE FUNCTION public.notify_record_sync();

CREATE TRIGGER trigger_sync_financial_transactions
  AFTER INSERT OR UPDATE ON public.financial_transactions FOR EACH ROW
  EXECUTE FUNCTION public.notify_record_sync();

CREATE TRIGGER trigger_sync_store_balances
  AFTER INSERT OR UPDATE ON public.store_balances FOR EACH ROW
  EXECUTE FUNCTION public.notify_record_sync();

CREATE TRIGGER trigger_sync_withdrawal_requests
  AFTER INSERT OR UPDATE ON public.withdrawal_requests FOR EACH ROW
  EXECUTE FUNCTION public.notify_record_sync();

CREATE TRIGGER trigger_sync_neighborhood_fees
  AFTER INSERT OR UPDATE ON public.neighborhood_fees FOR EACH ROW
  EXECUTE FUNCTION public.notify_record_sync();

CREATE TRIGGER trigger_sync_products
  AFTER INSERT OR UPDATE ON public.products FOR EACH ROW
  EXECUTE FUNCTION public.notify_record_sync();