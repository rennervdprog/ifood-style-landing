import { memo, useRef, useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Megaphone } from "lucide-react";

const PromoBanners = memo(() => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const { data: banners } = useQuery({
    queryKey: ["active-banners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banners" as any)
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Auto-scroll
  useEffect(() => {
    if (!banners || banners.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIdx(prev => (prev + 1) % banners.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [banners]);

  useEffect(() => {
    if (scrollRef.current && banners && banners.length > 0) {
      const el = scrollRef.current;
      const width = el.offsetWidth;
      el.scrollTo({ left: activeIdx * width, behavior: "smooth" });
    }
  }, [activeIdx, banners]);

  const handleClick = useCallback((banner: any) => {
    if (banner.link_type === "store" && banner.link_value) {
      navigate(`/${banner.link_value}`);
    } else if (banner.link_type === "url" && banner.link_value) {
      window.open(banner.link_value, "_blank");
    }
  }, [navigate]);

  if (!banners || banners.length === 0) return null;

  return (
    <div className="px-4 pt-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Megaphone className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold text-foreground">Promoções</h2>
      </div>
      <div ref={scrollRef} className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar gap-3 -mx-1 px-1">
        {banners.map((banner: any) => (
          <div
            key={banner.id}
            onClick={() => handleClick(banner)}
            className="snap-start flex-shrink-0 w-[calc(100%-8px)] cursor-pointer"
          >
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/20 h-28">
              {banner.image_url && (
                <img
                  src={banner.image_url}
                  alt={banner.title}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
              <div className="relative z-10 p-4 h-full flex flex-col justify-center">
                <h3 className="text-white font-black text-base leading-tight">{banner.title}</h3>
                {banner.subtitle && (
                  <p className="text-white/80 text-xs mt-1">{banner.subtitle}</p>
                )}
                {banner.link_type !== "none" && (
                  <div className="flex items-center gap-0.5 mt-2 text-white/90 text-[10px] font-bold">
                    Ver mais <ChevronRight className="h-3 w-3" />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {banners.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {banners.map((_: any, i: number) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === activeIdx ? "bg-primary w-4" : "bg-muted-foreground/30"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
});

PromoBanners.displayName = "PromoBanners";

export default PromoBanners;
