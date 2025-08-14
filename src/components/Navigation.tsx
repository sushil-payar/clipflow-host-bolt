import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Play, Upload, LayoutDashboard, Video } from "lucide-react";

const Navigation = () => {
  const location = useLocation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-video-border">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <Video className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              ClipFlow
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Button
              variant={location.pathname === "/dashboard" ? "hero" : "ghost"}
              size="sm"
              asChild
            >
              <Link to="/dashboard" className="flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
            </Button>
            
            <Button
              variant={location.pathname === "/upload" ? "hero" : "ghost"}
              size="sm"
              asChild
            >
              <Link to="/upload" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload
              </Link>
            </Button>
            
            <Button
              variant={location.pathname === "/auth" ? "hero" : "outline"}
              size="sm"
              asChild
            >
              <Link to="/auth" className="flex items-center gap-2">
                <Play className="w-4 h-4" />
                Sign In
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;