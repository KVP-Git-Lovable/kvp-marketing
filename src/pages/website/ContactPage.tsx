import { useEffect, useState } from "react";
import { WebsiteHeader } from "@/components/website/WebsiteHeader";
import { WebsiteFooter } from "@/components/website/WebsiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Clock, 
  MessageSquare, 
  MapPin, 
  Mail, 
  Phone, 
  Linkedin, 
  Globe,
  Users,
  Briefcase,
  HeadphonesIcon
} from "lucide-react";
import { toast } from "sonner";

type InquiryType = "general" | "sales" | "support" | "careers";

export const ContactPage = () => {
  const [inquiryType, setInquiryType] = useState<InquiryType>("general");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    company: "",
    phone: "",
    subject: "",
    message: ""
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.fullName || !formData.email || !formData.subject || !formData.message) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success("Message sent successfully! We'll get back to you soon.");
    setFormData({
      fullName: "",
      email: "",
      company: "",
      phone: "",
      subject: "",
      message: ""
    });
    setIsSubmitting(false);
  };

  const inquiryTypes: { id: InquiryType; label: string }[] = [
    { id: "general", label: "General" },
    { id: "sales", label: "Sales" },
    { id: "support", label: "Support" },
    { id: "careers", label: "Careers" }
  ];

  const offices = [
    {
      location: "India - Bangalore",
      address: [
        "Regus Tech37, 1st Floor,",
        "Plot No. 2A, Electronic City",
        "2nd Phase, Sy-No 37",
        "Bangalore 560100",
        "India"
      ]
    },
    {
      location: "India - Mangalore",
      address: [
        "3rd Floor, \"Bharath Mall\",",
        "Opp. to KSRTC Bus Stand",
        "Bejai Main Road, Lalbagh",
        "Mangalore - 575003",
        "India"
      ]
    },
    {
      location: "United States",
      address: [
        "8 The Green A, Dover",
        "DE 19901",
        "United States"
      ]
    }
  ];

  const departments = [
    {
      title: "Human Resources",
      category: "Careers",
      description: "Career opportunities, hiring inquiries, and employee relations",
      email: "hr@quickapp.ai",
      icon: Users
    },
    {
      title: "Sales Team",
      category: "Sales",
      description: "New business inquiries, partnership opportunities, and consultations",
      email: "sales@quickapp.ai",
      icon: Briefcase
    },
    {
      title: "Project Delivery",
      category: "Support",
      description: "Project management, delivery timelines, and technical support",
      email: "support@quickapp.ai",
      icon: HeadphonesIcon
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <WebsiteHeader />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent-gold/5 to-background" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyMjIiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              Get in Touch
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8">
              Ready to transform your field sales with AI? Let's start the conversation.
            </p>
            
            <div className="flex flex-wrap justify-center gap-4">
              <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm border border-border/50 rounded-full px-4 py-2">
                <Clock className="h-4 w-4 text-accent-gold" />
                <span className="text-sm text-muted-foreground">24/7 Support Available</span>
              </div>
              <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm border border-border/50 rounded-full px-4 py-2">
                <MessageSquare className="h-4 w-4 text-accent-gold" />
                <span className="text-sm text-muted-foreground">Response within 4 hours</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Contact Form */}
            <div className="lg:col-span-2">
              <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
                <h2 className="text-2xl font-bold text-foreground mb-2">Send us a Message</h2>
                <p className="text-muted-foreground mb-6">
                  Fill out the form below and we'll get back to you as soon as possible.
                </p>

                {/* Inquiry Type Tabs */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {inquiryTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setInquiryType(type.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        inquiryType === type.id
                          ? "bg-accent-gold text-accent-gold-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name *</Label>
                      <Input
                        id="fullName"
                        name="fullName"
                        placeholder="Your full name"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="your.email@company.com"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company">Company</Label>
                      <Input
                        id="company"
                        name="company"
                        placeholder="Your company name"
                        value={formData.company}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        placeholder="+1 (555) 123-4567"
                        value={formData.phone}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject *</Label>
                    <Input
                      id="subject"
                      name="subject"
                      placeholder="How can we help you?"
                      value={formData.subject}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Message *</Label>
                    <Textarea
                      id="message"
                      name="message"
                      placeholder="Tell us about your project or inquiry..."
                      rows={5}
                      value={formData.message}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-accent-gold hover:bg-accent-gold/90 text-accent-gold-foreground"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Sending..." : "Send Message"}
                  </Button>
                </form>
              </div>
            </div>

            {/* Sidebar - Offices */}
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-6">
                  <MapPin className="h-5 w-5 text-accent-gold" />
                  <h3 className="text-xl font-bold text-foreground">Our Offices</h3>
                </div>

                <div className="space-y-6">
                  {offices.map((office, index) => (
                    <div key={index}>
                      <h4 className="font-semibold text-foreground mb-2">{office.location}</h4>
                      <div className="text-sm text-muted-foreground space-y-0.5">
                        {office.address.map((line, i) => (
                          <p key={i}>{line}</p>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Office Hours</h4>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      <p>Monday - Friday: 9:00 AM - 6:00 PM</p>
                      <p>Saturday and Sunday: Closed</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Department Contacts */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-12">
            Department Contacts
          </h2>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {departments.map((dept, index) => (
              <div key={index} className="bg-card border border-border rounded-2xl p-6 text-center">
                <div className="w-12 h-12 bg-accent-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <dept.icon className="h-6 w-6 text-accent-gold" />
                </div>
                <h3 className="font-bold text-foreground mb-1">{dept.title}</h3>
                <span className="text-xs text-accent-gold font-medium">{dept.category}</span>
                <p className="text-sm text-muted-foreground mt-3 mb-4">{dept.description}</p>
                <a 
                  href={`mailto:${dept.email}`}
                  className="text-sm text-primary hover:text-primary/80 font-medium"
                >
                  {dept.email}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Connect With Us */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-8">
            Connect With Us
          </h2>

          <div className="flex flex-wrap justify-center gap-4">
            <a 
              href="https://linkedin.com/company/quickapp-ai" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-card border border-border rounded-xl px-6 py-4 hover:border-accent-gold/50 transition-colors"
            >
              <Linkedin className="h-6 w-6 text-[#0077B5]" />
              <div>
                <p className="font-medium text-foreground">LinkedIn</p>
                <p className="text-sm text-muted-foreground">@quickapp-ai</p>
              </div>
            </a>

            <a 
              href="https://quickapp.ai" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-card border border-border rounded-xl px-6 py-4 hover:border-accent-gold/50 transition-colors"
            >
              <Globe className="h-6 w-6 text-accent-gold" />
              <div>
                <p className="font-medium text-foreground">Website</p>
                <p className="text-sm text-muted-foreground">quickapp.ai</p>
              </div>
            </a>

            <a 
              href="mailto:hello@quickapp.ai"
              className="flex items-center gap-3 bg-card border border-border rounded-xl px-6 py-4 hover:border-accent-gold/50 transition-colors"
            >
              <Mail className="h-6 w-6 text-accent-gold" />
              <div>
                <p className="font-medium text-foreground">Email</p>
                <p className="text-sm text-muted-foreground">hello@quickapp.ai</p>
              </div>
            </a>

            <a 
              href="tel:+916361680976"
              className="flex items-center gap-3 bg-card border border-border rounded-xl px-6 py-4 hover:border-accent-gold/50 transition-colors"
            >
              <Phone className="h-6 w-6 text-accent-gold" />
              <div>
                <p className="font-medium text-foreground">Phone</p>
                <p className="text-sm text-muted-foreground">+91 63616 80976</p>
              </div>
            </a>
          </div>
        </div>
      </section>

      <WebsiteFooter />
    </div>
  );
};
