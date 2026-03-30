import { MapPin, ShoppingCart, User } from "lucide-react";

const Navbar = () => {
  return (
    <nav className="bg-background border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4 flex items-center justify-between h-16">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-black text-sm">iF</span>
          </div>
          <span className="text-xl font-black text-primary">
            foodly
          </span>
        </div>

        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 text-primary" />
          <span>R. Exemplo, 123 - São Paulo</span>
        </div>

        <div className="flex items-center gap-4">
          <button className="p-2 rounded-full hover:bg-muted transition-colors">
            <User className="h-5 w-5 text-foreground" />
          </button>
          <button className="relative p-2 rounded-full hover:bg-muted transition-colors">
            <ShoppingCart className="h-5 w-5 text-foreground" />
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
              2
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
