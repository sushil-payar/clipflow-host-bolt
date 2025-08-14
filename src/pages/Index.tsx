import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navigation from "@/components/Navigation";
import { Link } from "react-router-dom";
import { 
  Play, 
  Upload, 
  Zap, 
  Shield, 
  Globe, 
  BarChart3,
  CheckCircle
} from "lucide-react";

const Index = () => {
  const features = [
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Lightning Fast Compression",
      description: "Advanced algorithms compress videos to 70-80% while maintaining quality"
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Secure Cloud Storage",
      description: "Videos stored securely on Wasabi cloud infrastructure"
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: "Global CDN Delivery",
      description: "Fast streaming worldwide with optimized content delivery"
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Analytics & Insights",
      description: "Detailed viewing analytics and engagement metrics"
    }
  ];

  const benefits = [
    "Professional video hosting and streaming",
    "Automatic compression and optimization",
    "Customizable video player",
    "Advanced analytics dashboard",
    "Secure cloud storage",
    "Global content delivery network"
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Hero Section */}
      <section className="pt-24 pb-16 px-6">
        <div className="container mx-auto text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent leading-tight">
              Professional Video
              <br />
              Hosting Platform
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Upload, compress, and stream your videos with our advanced hosting platform. 
              Built for creators, businesses, and teams.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="hero" size="xl" asChild>
                <Link to="/upload" className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Start Uploading
                </Link>
              </Button>
              <Button variant="glass" size="xl" asChild>
                <Link to="/dashboard" className="flex items-center gap-2">
                  <Play className="w-5 h-5" />
                  View Dashboard
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-6">
        <div className="container mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Powerful Features for Video Hosting
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="bg-video-surface border-video-border hover:bg-video-surface-hover transition-all duration-300 group">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:shadow-glow transition-all duration-300">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 px-6 bg-video-surface">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Everything you need for professional video hosting
              </h2>
              <p className="text-muted-foreground mb-8 text-lg">
                Our platform provides all the tools and features you need to host, 
                manage, and analyze your video content effectively.
              </p>
              <div className="space-y-3">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-video-primary flex-shrink-0" />
                    <span className="text-foreground">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="relative">
              <div className="bg-gradient-surface rounded-2xl p-8 shadow-surface">
                <div className="bg-background rounded-lg p-6 border border-video-border">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-4 bg-video-surface rounded w-3/4"></div>
                    <div className="h-4 bg-video-surface rounded w-1/2"></div>
                    <div className="h-20 bg-gradient-primary rounded-lg"></div>
                    <div className="flex gap-2">
                      <div className="h-8 bg-video-surface rounded flex-1"></div>
                      <div className="h-8 bg-video-primary rounded w-20"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-6">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to get started?
          </h2>
          <p className="text-muted-foreground mb-8 text-lg max-w-2xl mx-auto">
            Join thousands of creators and businesses using our platform to host 
            and stream their video content professionally.
          </p>
          <Button variant="hero" size="xl" asChild>
            <Link to="/upload" className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Your First Video
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Index;