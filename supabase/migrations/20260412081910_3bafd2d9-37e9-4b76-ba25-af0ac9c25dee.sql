-- Add missing sync triggers for tables that support external sync

-- menu_sections
DROP TRIGGER IF EXISTS trigger_sync_menu_sections ON public.menu_sections;
CREATE TRIGGER trigger_sync_menu_sections
  AFTER INSERT OR UPDATE ON public.menu_sections FOR EACH ROW
  EXECUTE FUNCTION public.notify_record_sync();

-- addon_groups
DROP TRIGGER IF EXISTS trigger_sync_addon_groups ON public.addon_groups;
CREATE TRIGGER trigger_sync_addon_groups
  AFTER INSERT OR UPDATE ON public.addon_groups FOR EACH ROW
  EXECUTE FUNCTION public.notify_record_sync();

-- addon_items
DROP TRIGGER IF EXISTS trigger_sync_addon_items ON public.addon_items;
CREATE TRIGGER trigger_sync_addon_items
  AFTER INSERT OR UPDATE ON public.addon_items FOR EACH ROW
  EXECUTE FUNCTION public.notify_record_sync();

-- product_addon_groups
DROP TRIGGER IF EXISTS trigger_sync_product_addon_groups ON public.product_addon_groups;
CREATE TRIGGER trigger_sync_product_addon_groups
  AFTER INSERT OR UPDATE ON public.product_addon_groups FOR EACH ROW
  EXECUTE FUNCTION public.notify_record_sync();

-- opening_hours
DROP TRIGGER IF EXISTS trigger_sync_opening_hours ON public.opening_hours;
CREATE TRIGGER trigger_sync_opening_hours
  AFTER INSERT OR UPDATE ON public.opening_hours FOR EACH ROW
  EXECUTE FUNCTION public.notify_record_sync();

-- coupons
DROP TRIGGER IF EXISTS trigger_sync_coupons ON public.coupons;
CREATE TRIGGER trigger_sync_coupons
  AFTER INSERT OR UPDATE ON public.coupons FOR EACH ROW
  EXECUTE FUNCTION public.notify_record_sync();

-- banners
DROP TRIGGER IF EXISTS trigger_sync_banners ON public.banners;
CREATE TRIGGER trigger_sync_banners
  AFTER INSERT OR UPDATE ON public.banners FOR EACH ROW
  EXECUTE FUNCTION public.notify_record_sync();